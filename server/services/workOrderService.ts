import type { z } from 'zod';
import type { WorkOrder, WorkOrderStatus } from '../../src/types/fieldops';
import { hasPermission } from '../../src/services/rbacService';
import type { AuthUser } from '../auth';
import { conflict, forbidden, HttpError, notFound, unprocessable } from '../http';
import { DocumentExistsError, type DocStore, type Filter } from '../repositories/docStore';
import type { CreateWorkOrderBody, UpdateWorkOrderBody, WorkOrderListQuery } from '../domain/schemas';
import { canViewWorkOrder, checkTransition, isAssignee, transitionSideEffects } from '../domain/workOrderStateMachine';
import type { AuditService } from './auditService';

type WorkOrderDoc = WorkOrder & Record<string, unknown>;
type UpdateInput = z.infer<typeof UpdateWorkOrderBody>;

const LOCKED_STATUSES: WorkOrderStatus[] = ['APPROVED', 'CLOSED'];

export class WorkOrderService {
  constructor(
    private readonly store: DocStore,
    private readonly audit: AuditService
  ) {}

  async list(user: AuthUser, query: z.infer<typeof WorkOrderListQuery>): Promise<WorkOrder[]> {
    const filters: Filter[] = [];
    if (query.type) filters.push({ field: 'type', op: '==', value: query.type });
    if (query.status) filters.push({ field: 'status', op: '==', value: query.status });
    if (query.siteRole) filters.push({ field: 'siteRole', op: '==', value: query.siteRole });

    // Without oversight permission a caller only ever sees their own assignments, whatever they ask for.
    const assignee = hasPermission(user.role, 'VIEW_ALL_WORK_ORDERS') ? query.assigneeId : user.uid;
    if (assignee) filters.push({ field: 'assigneeIds', op: 'array-contains', value: assignee });

    const docs = await this.store.list<WorkOrderDoc>(user.orgId, 'work_orders', { filters });
    return docs.sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));
  }

  /** 404 for both "missing" and "not yours", so ids cannot be probed. */
  async get(user: AuthUser, id: string): Promise<WorkOrder> {
    const wo = await this.store.get<WorkOrderDoc>(user.orgId, 'work_orders', id);
    if (!wo || !canViewWorkOrder(user, wo)) throw notFound(`Work order '${id}' not found`);
    return wo;
  }

  async create(user: AuthUser, body: z.infer<typeof CreateWorkOrderBody>): Promise<WorkOrder> {
    const now = new Date().toISOString();
    const wo: WorkOrderDoc = {
      id: body.id ?? `wo-${crypto.randomUUID()}`,
      orgId: user.orgId,
      workOrderNumber: body.workOrderNumber,
      type: body.type,
      projectId: body.projectId ?? 'UNASSIGNED',
      regionId: body.regionId ?? 'UNASSIGNED',
      siteId: body.siteId,
      siteRole: body.siteRole,
      hopId: body.hopId ?? '',
      status: body.assigneeIds.length > 0 ? 'ASSIGNED' : 'DRAFT',
      scheduledDate: body.scheduledDate ?? now,
      assigneeIds: body.assigneeIds,
      currentStepIndex: 0,
      stepsData: {},
      tssrSnapshotVersion: body.tssrSnapshotVersion ?? 'v1',
      milestonePhase: body.milestonePhase,
      history: [{ timestamp: now, userId: user.uid, userName: user.name, action: 'CREATED' }],
      updatedAt: now,
      version: 1,
    };
    try {
      await this.store.create(user.orgId, 'work_orders', wo);
    } catch (err) {
      if (err instanceof DocumentExistsError) throw conflict(`Work order '${wo.id}' already exists`);
      throw err;
    }
    await this.audit.record(user, 'CREATE_WORK_ORDER', 'WORK_ORDER', wo.id, `Created ${wo.workOrderNumber} (${wo.type})`);
    return wo;
  }

  async update(user: AuthUser, id: string, body: UpdateInput): Promise<WorkOrder> {
    const { expectedVersion, ...changes } = body;
    const fields = Object.keys(changes);
    if (fields.length === 0) throw unprocessable('No updatable fields supplied');

    const updated = await this.store.transact<WorkOrderDoc>(user.orgId, 'work_orders', id, (current) => {
      const wo = this.assertWritable(user, current, id, expectedVersion);
      this.assertFieldPermissions(user, wo, changes);
      return {
        ...wo,
        ...changes,
        stepsData: changes.stepsData ? { ...wo.stepsData, ...changes.stepsData } : wo.stepsData,
        updatedAt: new Date().toISOString(),
        version: (wo.version ?? 0) + 1,
      } as WorkOrderDoc;
    });
    await this.audit.record(user, 'UPDATE_WORK_ORDER', 'WORK_ORDER', id, `Updated fields: ${fields.join(', ')}`);
    return updated;
  }

  async transition(
    user: AuthUser,
    id: string,
    to: WorkOrderStatus,
    reason?: string,
    expectedVersion?: number
  ): Promise<WorkOrder> {
    let from: WorkOrderStatus | undefined;
    const updated = await this.store.transact<WorkOrderDoc>(user.orgId, 'work_orders', id, (current) => {
      if (!current || !canViewWorkOrder(user, current)) throw notFound(`Work order '${id}' not found`);
      this.assertVersion(current, expectedVersion);
      const check = checkTransition(user, current, to, reason);
      if (!check.ok) throw new HttpError(check.status, check.message, check.status === 403 ? 'FORBIDDEN' : 'UNPROCESSABLE');
      from = current.status;
      const now = new Date().toISOString();
      return {
        ...current,
        ...transitionSideEffects(user, to, now),
        status: to,
        reviewerRemarks: to === 'REJECTED' ? reason : current.reviewerRemarks,
        history: [
          ...(current.history ?? []),
          { timestamp: now, userId: user.uid, userName: user.name, action: `STATUS_${to}`, note: reason },
        ],
        updatedAt: now,
        version: (current.version ?? 0) + 1,
      } as WorkOrderDoc;
    });
    await this.audit.record(
      user,
      'TRANSITION_STATUS',
      'WORK_ORDER',
      id,
      `${from} → ${to}${reason ? `. Reason: ${reason}` : ''}`
    );
    return updated;
  }

  async delete(user: AuthUser, id: string): Promise<void> {
    const removed = await this.store.delete(user.orgId, 'work_orders', id);
    if (!removed) throw notFound(`Work order '${id}' not found`);
    await this.audit.record(user, 'DELETE_WORK_ORDER', 'WORK_ORDER', id, 'Deleted work order');
  }

  private assertVersion(wo: WorkOrder, expectedVersion?: number) {
    if (expectedVersion !== undefined && (wo.version ?? 0) !== expectedVersion) {
      throw conflict('Work order was modified by someone else. Reload and retry.', {
        expectedVersion,
        currentVersion: wo.version ?? 0,
      });
    }
  }

  private assertWritable(user: AuthUser, current: WorkOrderDoc | null, id: string, expectedVersion?: number) {
    if (!current || !canViewWorkOrder(user, current)) throw notFound(`Work order '${id}' not found`);
    this.assertVersion(current, expectedVersion);
    if (LOCKED_STATUSES.includes(current.status)) {
      throw unprocessable(`Work order is ${current.status} and can no longer be edited`);
    }
    return current;
  }

  private assertFieldPermissions(user: AuthUser, wo: WorkOrder, changes: Omit<UpdateInput, 'expectedVersion'>) {
    const canAssign = hasPermission(user.role, 'ASSIGN_WORK_ORDERS');
    if ((changes.assigneeIds || changes.scheduledDate) && !canAssign) {
      throw forbidden('Only project managers can reassign or reschedule work orders');
    }
    if (
      changes.reviewerRemarks !== undefined &&
      !hasPermission(user.role, 'APPROVE_WORK_ORDER') &&
      !hasPermission(user.role, 'REJECT_WORK_ORDER')
    ) {
      throw forbidden('Only reviewers can set reviewer remarks');
    }
    const touchesExecution =
      changes.stepsData !== undefined || changes.currentStepIndex !== undefined || changes.milestonePhase !== undefined;
    if (touchesExecution && !isAssignee(user, wo) && !hasPermission(user.role, 'EDIT_WORK_ORDER_SETTINGS')) {
      throw forbidden('Only assigned crew can record progress on this work order');
    }
  }
}
