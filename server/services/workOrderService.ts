import crypto from 'crypto';
import { DocStore } from '../repositories/docStore';
import { AuditService } from './auditService';
import { AuthUser } from '../auth';
import { WorkOrder } from '../../src/types/fieldops';
import { hasPermission } from '../../src/services/rbacService';
import { notFound, conflict, unprocessable, forbidden } from '../http';
import { CreateWorkOrderInput, PatchWorkOrderInput, TransitionWorkOrderInput } from '../domain/schemas';
import { validateAndApplyTransition } from '../domain/workOrderStateMachine';

export class WorkOrderService {
  private store: DocStore;
  private audit: AuditService;

  constructor(store: DocStore, audit: AuditService) {
    this.store = store;
    this.audit = audit;
  }

  async list(
    user: AuthUser,
    filters?: { type?: string; status?: string; siteRole?: string; assigneeId?: string }
  ): Promise<WorkOrder[]> {
    const canViewAll = hasPermission(user.role, 'VIEW_ALL_WORK_ORDERS');

    const storeFilters: Array<{ field: string; op: '==' | 'array-contains'; value: any }> = [];

    if (filters?.type) {
      storeFilters.push({ field: 'type', op: '==', value: filters.type });
    }
    if (filters?.status) {
      storeFilters.push({ field: 'status', op: '==', value: filters.status });
    }
    if (filters?.siteRole) {
      storeFilters.push({ field: 'siteRole', op: '==', value: filters.siteRole });
    }

    if (canViewAll) {
      if (filters?.assigneeId) {
        storeFilters.push({ field: 'assigneeIds', op: 'array-contains', value: filters.assigneeId });
      }
    } else {
      // Non-managers strictly see only their assigned work orders; ignore any query param
      storeFilters.push({ field: 'assigneeIds', op: 'array-contains', value: user.uid });
    }

    let items = await this.store.list<WorkOrder>(user.orgId, 'work_orders', {
      filters: storeFilters,
      limit: 500,
    });

    // In-memory safety guard ensuring visibility compliance
    if (!canViewAll) {
      items = items.filter(
        (w) => Array.isArray(w.assigneeIds) && w.assigneeIds.includes(user.uid)
      );
    }

    return items;
  }

  async getById(user: AuthUser, id: string): Promise<WorkOrder> {
    const wo = await this.store.get<WorkOrder>(user.orgId, 'work_orders', id);
    if (!wo) {
      throw notFound(`Work order '${id}' not found`);
    }

    const canViewAll = hasPermission(user.role, 'VIEW_ALL_WORK_ORDERS');
    const isAssignee = Array.isArray(wo.assigneeIds) && wo.assigneeIds.includes(user.uid);

    if (!canViewAll && !isAssignee) {
      // Must return 404, never 403, for unauthorized visibility
      throw notFound(`Work order '${id}' not found`);
    }

    return wo;
  }

  async create(user: AuthUser, input: CreateWorkOrderInput): Promise<WorkOrder> {
    const nowIso = new Date().toISOString();
    const hasAssignees = Array.isArray(input.assigneeIds) && input.assigneeIds.length > 0;
    const initialStatus = hasAssignees ? 'ASSIGNED' : 'DRAFT';

    const wo: WorkOrder = {
      id: `wo_${crypto.randomUUID().slice(0, 8)}`,
      version: 1,
      orgId: user.orgId,
      workOrderNumber: input.workOrderNumber,
      type: input.type,
      siteId: input.siteId,
      siteRole: input.siteRole || 'B',
      hopId: input.hopId || 'hop-ter25-01',
      projectId: input.projectId || 'PRJ-TER25-PH',
      regionId: input.regionId || 'MIN',
      scheduledDate: input.scheduledDate || nowIso,
      assigneeIds: input.assigneeIds || [],
      status: initialStatus,
      currentStepIndex: 0,
      stepsData: {},
      tssrSnapshotVersion: input.tssrSnapshotVersion || 'v1.4',
      milestonePhase: (input.milestonePhase as any) || 'PHASE_1_CIVIL',
      history: [
        {
          timestamp: nowIso,
          userId: user.uid,
          userName: user.name,
          action: 'CREATED_VIA_API',
          note: `Work order created with status ${initialStatus}`,
        },
      ],
      updatedAt: nowIso,
    };

    const created = await this.store.create<WorkOrder>(user.orgId, 'work_orders', wo);

    await this.audit.record(
      user,
      'CREATE_WORK_ORDER',
      created.id,
      'WORK_ORDER',
      `Created work order ${created.workOrderNumber} (${created.type})`
    );

    return created;
  }

  async patch(user: AuthUser, id: string, input: PatchWorkOrderInput): Promise<WorkOrder> {
    const updated = await this.store.transact<WorkOrder>(
      user.orgId,
      'work_orders',
      id,
      async (current) => {
        if (!current) {
          throw notFound(`Work order '${id}' not found`);
        }

        const canViewAll = hasPermission(user.role, 'VIEW_ALL_WORK_ORDERS');
        const isAssignee = Array.isArray(current.assigneeIds) && current.assigneeIds.includes(user.uid);
        if (!canViewAll && !isAssignee) {
          throw notFound(`Work order '${id}' not found`);
        }

        if (current.status === 'APPROVED' || current.status === 'CLOSED') {
          throw unprocessable(`Work order is ${current.status} and cannot be modified`);
        }

        if (input.expectedVersion != null && current.version !== input.expectedVersion) {
          throw conflict('Work order was modified by someone else', {
            expectedVersion: input.expectedVersion,
            currentVersion: current.version,
          });
        }

        // Granular permission checks on changed fields
        if (input.assigneeIds !== undefined || input.scheduledDate !== undefined) {
          if (!hasPermission(user.role, 'ASSIGN_WORK_ORDERS')) {
            throw forbidden("Permission 'ASSIGN_WORK_ORDERS' required to modify assignments or schedule");
          }
        }

        if (input.reviewerRemarks !== undefined) {
          const canApprove = hasPermission(user.role, 'APPROVE_WORK_ORDER');
          const canReject = hasPermission(user.role, 'REJECT_WORK_ORDER');
          if (!canApprove && !canReject) {
            throw forbidden("Permission 'APPROVE_WORK_ORDER' or 'REJECT_WORK_ORDER' required to modify remarks");
          }
        }

        const touchesProgress =
          input.currentStepIndex !== undefined ||
          input.stepsData !== undefined ||
          input.milestonePhase !== undefined;

        if (touchesProgress) {
          const canEditSettings = hasPermission(user.role, 'EDIT_WORK_ORDER_SETTINGS');
          if (!isAssignee && !canEditSettings) {
            throw forbidden("Must be an assigned technician or have 'EDIT_WORK_ORDER_SETTINGS' to update progress");
          }
        }

        const nowIso = new Date().toISOString();
        const next: WorkOrder = {
          ...current,
          version: (current.version || 1) + 1,
          updatedAt: nowIso,
        };

        if (input.currentStepIndex !== undefined) next.currentStepIndex = input.currentStepIndex;
        if (input.milestonePhase !== undefined) next.milestonePhase = input.milestonePhase as any;
        if (input.scheduledDate !== undefined) next.scheduledDate = input.scheduledDate;
        if (input.assigneeIds !== undefined) next.assigneeIds = input.assigneeIds;
        if (input.reviewerRemarks !== undefined) next.reviewerRemarks = input.reviewerRemarks;

        if (input.stepsData) {
          next.stepsData = {
            ...(current.stepsData || {}),
            ...input.stepsData,
          };
        }

        next.history = [
          ...(current.history || []),
          {
            timestamp: nowIso,
            userId: user.uid,
            userName: user.name,
            action: 'UPDATE_FIELDS',
            note: `Updated fields: ${Object.keys(input).filter((k) => k !== 'expectedVersion').join(', ')}`,
          },
        ];

        return next;
      }
    );

    await this.audit.record(
      user,
      'UPDATE_WORK_ORDER',
      updated.id,
      'WORK_ORDER',
      `Updated work order ${updated.workOrderNumber} (v${updated.version})`
    );

    return updated;
  }

  async transition(user: AuthUser, id: string, input: TransitionWorkOrderInput): Promise<WorkOrder> {
    const updated = await this.store.transact<WorkOrder>(
      user.orgId,
      'work_orders',
      id,
      async (current) => {
        if (!current) {
          throw notFound(`Work order '${id}' not found`);
        }

        const canViewAll = hasPermission(user.role, 'VIEW_ALL_WORK_ORDERS');
        const isAssignee = Array.isArray(current.assigneeIds) && current.assigneeIds.includes(user.uid);
        if (!canViewAll && !isAssignee) {
          throw notFound(`Work order '${id}' not found`);
        }

        if (input.expectedVersion != null && current.version !== input.expectedVersion) {
          throw conflict('Work order was modified by someone else', {
            expectedVersion: input.expectedVersion,
            currentVersion: current.version,
          });
        }

        const next = validateAndApplyTransition(current, {
          newStatus: input.newStatus,
          user,
          reason: input.reason,
        });

        next.version = (current.version || 1) + 1;
        return next;
      }
    );

    await this.audit.record(
      user,
      'TRANSITION_STATUS',
      updated.id,
      'WORK_ORDER',
      `Transitioned status to ${updated.status} (v${updated.version})`
    );

    return updated;
  }

  async delete(user: AuthUser, id: string): Promise<void> {
    const wo = await this.store.get<WorkOrder>(user.orgId, 'work_orders', id);
    if (!wo) {
      throw notFound(`Work order '${id}' not found`);
    }

    const canViewAll = hasPermission(user.role, 'VIEW_ALL_WORK_ORDERS');
    const isAssignee = Array.isArray(wo.assigneeIds) && wo.assigneeIds.includes(user.uid);
    if (!canViewAll && !isAssignee) {
      throw notFound(`Work order '${id}' not found`);
    }

    await this.store.delete(user.orgId, 'work_orders', id);

    await this.audit.record(
      user,
      'DELETE_WORK_ORDER',
      id,
      'WORK_ORDER',
      `Deleted work order ${wo.workOrderNumber}`
    );
  }
}
