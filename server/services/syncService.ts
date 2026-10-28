import { DocStore } from '../repositories/docStore';
import { AuditService } from './auditService';
import { AuthUser } from '../auth';
import { hasPermission } from '../../src/services/rbacService';
import { createWorkOrderSchema } from '../domain/schemas';
import { validateAndApplyTransition } from '../domain/workOrderStateMachine';
import { WorkOrder, InventoryItem } from '../../src/types/fieldops';

export interface SyncMutation {
  id: string;
  collectionName: string;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload?: any;
  baseVersion?: number;
}

export interface MutationResult {
  id: string;
  status: 'APPLIED' | 'REJECTED' | 'CONFLICT';
  error?: string;
  version?: number;
}

export interface SyncBatchResponse {
  syncedCount: number;
  processedIds: string[];
  results: MutationResult[];
  serverTimestamp: string;
}

export class SyncService {
  private store: DocStore;
  private audit: AuditService;

  constructor(store: DocStore, audit: AuditService) {
    this.store = store;
    this.audit = audit;
  }

  async processBatch(user: AuthUser, mutations: SyncMutation[]): Promise<SyncBatchResponse> {
    const results: MutationResult[] = [];
    const appliedIds: string[] = [];
    const nowIso = new Date().toISOString();

    for (const mut of mutations.slice(0, 200)) {
      try {
        const res = await this.processMutation(user, mut, nowIso);
        results.push(res);
        if (res.status === 'APPLIED') {
          appliedIds.push(mut.id);
        }
      } catch (err: any) {
        results.push({
          id: mut.id,
          status: 'REJECTED',
          error: err?.message || 'Mutation processing error',
        });
      }
    }

    // Record one single CLOUD_BATCH_SYNC audit entry for the batch
    await this.audit.record(
      user,
      'CLOUD_BATCH_SYNC',
      'sync_gateway',
      'SYNC_GATEWAY',
      `Processed batch with ${appliedIds.length} applied mutations (${results.length - appliedIds.length} rejected/conflict).`
    );

    return {
      syncedCount: appliedIds.length,
      processedIds: appliedIds,
      results,
      serverTimestamp: nowIso,
    };
  }

  private async processMutation(
    user: AuthUser,
    mut: SyncMutation,
    nowIso: string
  ): Promise<MutationResult> {
    const { collectionName, entityId, operation, payload, baseVersion } = mut;

    // Check payload size limit (max 900KB)
    if (payload && Buffer.byteLength(JSON.stringify(payload)) > 900000) {
      return { id: mut.id, status: 'REJECTED', error: 'Payload exceeds 900,000 bytes limit' };
    }

    switch (collectionName) {
      case 'work_orders':
        return await this.processWorkOrderMutation(user, mut, nowIso);

      case 'inventory':
        return await this.processInventoryMutation(user, mut, nowIso);

      case 'tickets':
      case 'photos':
      case 'tssr_approvals':
        return await this.processMergeUpsertMutation(user, mut, nowIso);

      case 'audit_logs':
        return await this.processClientAuditLogMutation(user, mut, nowIso);

      default:
        return {
          id: mut.id,
          status: 'REJECTED',
          error: `Unsupported collection '${collectionName}'`,
        };
    }
  }

  private async processWorkOrderMutation(
    user: AuthUser,
    mut: SyncMutation,
    nowIso: string
  ): Promise<MutationResult> {
    const { entityId, operation, payload, baseVersion } = mut;

    if (operation === 'DELETE') {
      if (!hasPermission(user.role, 'EDIT_WORK_ORDER_SETTINGS')) {
        return { id: mut.id, status: 'REJECTED', error: "Permission 'EDIT_WORK_ORDER_SETTINGS' required to delete" };
      }
      await this.store.delete(user.orgId, 'work_orders', entityId);
      return { id: mut.id, status: 'APPLIED' };
    }

    if (operation === 'CREATE') {
      if (!hasPermission(user.role, 'CREATE_WORK_ORDER')) {
        return { id: mut.id, status: 'REJECTED', error: "Permission 'CREATE_WORK_ORDER' required" };
      }
      const validated = createWorkOrderSchema.safeParse(payload);
      if (!validated.success) {
        return { id: mut.id, status: 'REJECTED', error: `Create validation failed: ${validated.error.message}` };
      }

      const existing = await this.store.get<WorkOrder>(user.orgId, 'work_orders', entityId);
      if (existing) {
        return { id: mut.id, status: 'CONFLICT', error: 'Work order already exists' };
      }

      const hasAssignees = Array.isArray(validated.data.assigneeIds) && validated.data.assigneeIds.length > 0;
      const initialStatus = hasAssignees ? 'ASSIGNED' : 'DRAFT';

      const newWo: WorkOrder = {
        ...validated.data,
        id: entityId,
        orgId: user.orgId,
        version: 1,
        status: initialStatus,
        siteRole: validated.data.siteRole || 'B',
        hopId: validated.data.hopId || 'hop-ter25-01',
        projectId: validated.data.projectId || 'PRJ-TER25-PH',
        regionId: validated.data.regionId || 'MIN',
        scheduledDate: validated.data.scheduledDate || nowIso,
        assigneeIds: validated.data.assigneeIds || [],
        milestonePhase: (validated.data.milestonePhase as any) || 'PHASE_1_CIVIL',
        currentStepIndex: 0,
        stepsData: {},
        tssrSnapshotVersion: validated.data.tssrSnapshotVersion || 'v1.4',
        history: [
          {
            timestamp: nowIso,
            userId: user.uid,
            userName: user.name,
            action: 'CREATED_VIA_SYNC',
            note: 'Created via offline sync gateway',
          },
        ],
        updatedAt: nowIso,
      };

      await this.store.create(user.orgId, 'work_orders', newWo);
      return { id: mut.id, status: 'APPLIED', version: 1 };
    }

    if (operation === 'UPDATE') {
      let updatedVersion = 1;
      try {
        await this.store.transact<WorkOrder>(user.orgId, 'work_orders', entityId, async (current) => {
          if (!current) {
            throw new Error('Work order not found');
          }

          if (baseVersion != null && current.version !== baseVersion) {
            const conflictErr: any = new Error('Base version mismatch');
            conflictErr.isConflict = true;
            throw conflictErr;
          }

          // Check status transition validity BEFORE applying any partial changes
          if (payload?.status && payload.status !== current.status) {
            validateAndApplyTransition(current, {
              newStatus: payload.status,
              user,
              reason: payload.reason,
            });
          }

          const isAssignee = Array.isArray(current.assigneeIds) && current.assigneeIds.includes(user.uid);
          const canAssign = hasPermission(user.role, 'ASSIGN_WORK_ORDERS');
          const canEditSettings = hasPermission(user.role, 'EDIT_WORK_ORDER_SETTINGS');

          if (payload.assigneeIds !== undefined || payload.scheduledDate !== undefined) {
            if (!canAssign) throw new Error("Permission 'ASSIGN_WORK_ORDERS' required");
          }

          const touchesProgress =
            payload.currentStepIndex !== undefined ||
            payload.stepsData !== undefined ||
            payload.milestonePhase !== undefined;

          if (touchesProgress && !isAssignee && !canEditSettings) {
            throw new Error("Assignee or 'EDIT_WORK_ORDER_SETTINGS' required to update progress");
          }

          const next: WorkOrder = {
            ...current,
            version: (current.version || 1) + 1,
            updatedAt: nowIso,
          };

          if (payload.currentStepIndex !== undefined) next.currentStepIndex = payload.currentStepIndex;
          if (payload.milestonePhase !== undefined) next.milestonePhase = payload.milestonePhase;
          if (payload.scheduledDate !== undefined) next.scheduledDate = payload.scheduledDate;
          if (payload.assigneeIds !== undefined) next.assigneeIds = payload.assigneeIds;
          if (payload.stepsData) {
            next.stepsData = { ...(current.stepsData || {}), ...payload.stepsData };
          }
          if (payload.status && payload.status !== current.status) {
            const transitioned = validateAndApplyTransition(next, {
              newStatus: payload.status,
              user,
              reason: payload.reason,
            });
            next.status = transitioned.status;
            next.history = transitioned.history;
            next.startedAt = transitioned.startedAt;
            next.completedAt = transitioned.completedAt;
            next.approvedAt = transitioned.approvedAt;
            next.approvedBy = transitioned.approvedBy;
            next.reviewerRemarks = transitioned.reviewerRemarks;
          }

          updatedVersion = next.version!;
          return next;
        });

        return { id: mut.id, status: 'APPLIED', version: updatedVersion };
      } catch (err: any) {
        if (err.isConflict) {
          return { id: mut.id, status: 'CONFLICT', error: 'Work order was modified by someone else' };
        }
        return { id: mut.id, status: 'REJECTED', error: err.message };
      }
    }

    return { id: mut.id, status: 'REJECTED', error: `Unknown operation '${operation}'` };
  }

  private async processInventoryMutation(
    user: AuthUser,
    mut: SyncMutation,
    nowIso: string
  ): Promise<MutationResult> {
    const { entityId, operation, payload } = mut;

    if (operation === 'DELETE') {
      if (!hasPermission(user.role, 'MANAGE_INVENTORY_LEDGER')) {
        return { id: mut.id, status: 'REJECTED', error: "Permission 'MANAGE_INVENTORY_LEDGER' required to delete" };
      }
      await this.store.delete(user.orgId, 'inventory', entityId);
      return { id: mut.id, status: 'APPLIED' };
    }

    if (operation === 'CREATE') {
      if (!hasPermission(user.role, 'MANAGE_INVENTORY_LEDGER')) {
        return { id: mut.id, status: 'REJECTED', error: "Permission 'MANAGE_INVENTORY_LEDGER' required to create" };
      }
      if (!payload?.siteId || !payload?.equipmentType || !payload?.model || !payload?.serialNumber || !payload?.assetTag) {
        return {
          id: mut.id,
          status: 'REJECTED',
          error: 'Inventory CREATE requires siteId, equipmentType, model, serialNumber, and assetTag',
        };
      }
      const item: InventoryItem = {
        ...payload,
        id: entityId,
        orgId: user.orgId,
        updatedAt: nowIso,
      };
      await this.store.create(user.orgId, 'inventory', item);
      return { id: mut.id, status: 'APPLIED' };
    }

    if (operation === 'UPDATE') {
      const canUpdate =
        hasPermission(user.role, 'QR_INVENTORY_SCAN') ||
        hasPermission(user.role, 'SIGN_CHAIN_OF_CUSTODY') ||
        hasPermission(user.role, 'MANAGE_INVENTORY_LEDGER');

      if (!canUpdate) {
        return {
          id: mut.id,
          status: 'REJECTED',
          error: 'Insufficient permissions to update inventory',
        };
      }

      const allowedFields = new Set([
        'condition',
        'status',
        'photoBeforeUrl',
        'photoAfterUrl',
        'destinationWarehouse',
        'chainOfCustodySigner',
        'removalDate',
        'notes',
      ]);

      await this.store.transact<InventoryItem>(user.orgId, 'inventory', entityId, async (current) => {
        if (!current) throw new Error('Inventory item not found');
        const next: any = { ...current, updatedAt: nowIso };
        for (const [key, val] of Object.entries(payload || {})) {
          if (allowedFields.has(key)) {
            next[key] = val;
          }
        }
        return next as InventoryItem;
      });

      return { id: mut.id, status: 'APPLIED' };
    }

    return { id: mut.id, status: 'REJECTED', error: `Unknown operation '${operation}'` };
  }

  private async processMergeUpsertMutation(
    user: AuthUser,
    mut: SyncMutation,
    nowIso: string
  ): Promise<MutationResult> {
    const { collectionName, entityId, payload } = mut;

    if (collectionName === 'tickets') {
      if (!hasPermission(user.role, 'RESOLVE_TROUBLE_TICKET')) {
        return { id: mut.id, status: 'REJECTED', error: "Permission 'RESOLVE_TROUBLE_TICKET' required" };
      }
    } else if (collectionName === 'photos') {
      if (!hasPermission(user.role, 'PHOTO_CAPTURE_UPLOAD')) {
        return { id: mut.id, status: 'REJECTED', error: "Permission 'PHOTO_CAPTURE_UPLOAD' required" };
      }
    } else if (collectionName === 'tssr_approvals') {
      const allowed =
        hasPermission(user.role, 'SIGN_TSSR_ROUTING') ||
        hasPermission(user.role, 'UPLOAD_TSSR') ||
        hasPermission(user.role, 'SIGN_SAFETY_GATE') ||
        hasPermission(user.role, 'FIELD_DATA_LOGGING');
      if (!allowed) {
        return { id: mut.id, status: 'REJECTED', error: 'Insufficient permissions for tssr_approvals' };
      }
    }

    await this.store.transact(user.orgId, collectionName, entityId, async (current) => {
      return {
        ...(current || {}),
        ...(payload || {}),
        id: entityId,
        orgId: user.orgId,
        updatedAt: nowIso,
        updatedBy: user.uid,
      };
    });

    return { id: mut.id, status: 'APPLIED' };
  }

  private async processClientAuditLogMutation(
    user: AuthUser,
    mut: SyncMutation,
    nowIso: string
  ): Promise<MutationResult> {
    const { payload } = mut;
    const clientAction = payload?.action || 'CLIENT_MUTATION';

    // Never trust userId or userName from payload; strictly use server-authenticated user
    await this.audit.record(
      user,
      `CLIENT_${clientAction}`,
      payload?.targetId || mut.entityId,
      payload?.targetType || 'CLIENT_ENTITY',
      payload?.details || 'Client-reported audit entry'
    );

    return { id: mut.id, status: 'APPLIED' };
  }
}
