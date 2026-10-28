import type { z } from 'zod';
import type { InventoryItem, WorkOrder, WorkOrderStatus } from '../../src/types/fieldops';
import { hasAnyPermission, hasPermission, type Permission } from '../../src/services/rbacService';
import type { AuthUser } from '../auth';
import { HttpError } from '../http';
import type { DocStore } from '../repositories/docStore';
import { CreateWorkOrderBody, UpdateWorkOrderBody, type SyncBatchBody } from '../domain/schemas';
import { checkTransition } from '../domain/workOrderStateMachine';
import type { AuditService } from './auditService';
import type { WorkOrderService } from './workOrderService';

type Mutation = z.infer<typeof SyncBatchBody>['mutations'][number];

export interface MutationResult {
  id: string;
  status: 'APPLIED' | 'REJECTED' | 'CONFLICT';
  error?: string;
  version?: number;
}

/** Firestore caps a document at 1 MiB; leave headroom for metadata. */
const MAX_DOC_BYTES = 900_000;

const WORK_ORDER_SYNC_FIELDS = ['currentStepIndex', 'stepsData', 'milestonePhase', 'scheduledDate', 'assigneeIds'] as const;
const INVENTORY_SYNC_FIELDS = [
  'condition',
  'status',
  'photoBeforeUrl',
  'photoAfterUrl',
  'destinationWarehouse',
  'chainOfCustodySigner',
  'removalDate',
  'notes',
] as const;

const GENERIC_WRITE_PERMISSIONS: Record<'tickets' | 'photos' | 'tssr_approvals', Permission[]> = {
  tickets: ['RESOLVE_TROUBLE_TICKET'],
  photos: ['PHOTO_CAPTURE_UPLOAD'],
  tssr_approvals: ['SIGN_TSSR_ROUTING', 'UPLOAD_TSSR', 'SIGN_SAFETY_GATE', 'FIELD_DATA_LOGGING'],
};

class Rejected extends Error {}
const reject = (msg: string): never => {
  throw new Rejected(msg);
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Applies the offline replica's mutation queue. Each mutation is authorised and
 * validated on its own; clients never write raw documents, and one bad mutation
 * does not block the rest of the batch.
 */
export class SyncService {
  constructor(
    private readonly store: DocStore,
    private readonly workOrders: WorkOrderService,
    private readonly audit: AuditService
  ) {}

  async applyBatch(user: AuthUser, mutations: Mutation[]): Promise<MutationResult[]> {
    const results: MutationResult[] = [];
    for (const m of mutations) {
      try {
        const version = await this.apply(user, m);
        results.push({ id: m.id, status: 'APPLIED', version });
      } catch (err) {
        if (err instanceof Rejected) {
          results.push({ id: m.id, status: 'REJECTED', error: err.message });
        } else if (err instanceof HttpError) {
          results.push({ id: m.id, status: err.status === 409 ? 'CONFLICT' : 'REJECTED', error: err.message });
        } else {
          throw err;
        }
      }
    }
    const applied = results.filter((r) => r.status === 'APPLIED').length;
    await this.audit.record(user, 'CLOUD_BATCH_SYNC', 'REPLICATION', 'sync-gateway', `Applied ${applied}/${mutations.length} offline mutations`);
    return results;
  }

  private async apply(user: AuthUser, m: Mutation): Promise<number | undefined> {
    const payload = m.payload ?? {};
    switch (m.collectionName) {
      case 'work_orders':
        return this.applyWorkOrder(user, m, payload);
      case 'inventory':
        await this.applyInventory(user, m, payload);
        return undefined;
      case 'audit_logs':
        // Client audit events are kept, but the server decides who did it and when.
        await this.audit.record(
          user,
          `CLIENT_${String(payload.action ?? 'EVENT').slice(0, 60)}`,
          String(payload.targetType ?? 'CLIENT').slice(0, 60),
          String(payload.targetId ?? m.entityId).slice(0, 128),
          String(payload.details ?? '')
        );
        return undefined;
      default:
        await this.applyGeneric(user, m.collectionName, m, payload);
        return undefined;
    }
  }

  private async applyWorkOrder(user: AuthUser, m: Mutation, payload: Record<string, unknown>) {
    if (m.operation === 'DELETE') {
      if (!hasPermission(user.role, 'EDIT_WORK_ORDER_SETTINGS')) reject('Not permitted to delete work orders');
      await this.workOrders.delete(user, m.entityId);
      return undefined;
    }

    const current = await this.store.get<WorkOrder & Record<string, unknown>>(user.orgId, 'work_orders', m.entityId);
    if (!current) {
      if (!hasPermission(user.role, 'CREATE_WORK_ORDER')) reject('Not permitted to create work orders');
      const body = CreateWorkOrderBody.safeParse({
        id: m.entityId,
        workOrderNumber: payload.workOrderNumber,
        type: payload.type,
        siteId: payload.siteId,
        siteRole: payload.siteRole,
        hopId: payload.hopId,
        projectId: payload.projectId,
        regionId: payload.regionId,
        scheduledDate: payload.scheduledDate,
        assigneeIds: payload.assigneeIds,
        tssrSnapshotVersion: payload.tssrSnapshotVersion,
      });
      if (!body.success) reject(`Invalid work order: ${body.error.issues[0]?.message}`);
      return (await this.workOrders.create(user, body.data!)).version;
    }

    if (m.baseVersion !== undefined && m.baseVersion !== (current.version ?? 0)) {
      throw new HttpError(409, 'Server copy changed since this edit was made', 'CONFLICT');
    }

    // Only fields that actually changed are applied, so unchanged echoes of
    // privileged fields (assignees, schedule) don't trip permission checks.
    const changes: Record<string, unknown> = {};
    for (const f of WORK_ORDER_SYNC_FIELDS) {
      if (f in payload && !same(payload[f], current[f])) changes[f] = payload[f];
    }
    const parsed = UpdateWorkOrderBody.safeParse(changes);
    if (!parsed.success) reject(`Invalid work order update: ${parsed.error.issues[0]?.message}`);

    // Check the status change up front so a mutation is applied whole or not at all.
    const nextStatus = payload.status as WorkOrderStatus | undefined;
    const statusChanges = Boolean(nextStatus && nextStatus !== current.status);
    if (statusChanges) {
      const check = checkTransition(user, current, nextStatus!);
      if (!check.ok) reject(check.message);
    }

    let version = current.version ?? 0;
    if (Object.keys(changes).length > 0) {
      version = (await this.workOrders.update(user, m.entityId, { ...parsed.data!, expectedVersion: version })).version ?? version;
    }
    if (statusChanges) {
      version = (await this.workOrders.transition(user, m.entityId, nextStatus!, undefined, version)).version ?? version;
    }
    return version;
  }

  private async applyInventory(user: AuthUser, m: Mutation, payload: Record<string, unknown>) {
    const canManage = hasPermission(user.role, 'MANAGE_INVENTORY_LEDGER');
    if (m.operation === 'DELETE') {
      if (!canManage) reject('Not permitted to delete inventory');
      await this.store.delete(user.orgId, 'inventory', m.entityId);
      return;
    }
    if (!canManage && !hasAnyPermission(user.role, ['QR_INVENTORY_SCAN', 'SIGN_CHAIN_OF_CUSTODY'])) {
      reject('Not permitted to update inventory');
    }
    await this.store.transact<InventoryItem & Record<string, unknown>>(user.orgId, 'inventory', m.entityId, (current) => {
      if (!current) {
        if (!canManage) reject('Not permitted to register new inventory');
        for (const f of ['siteId', 'equipmentType', 'model', 'serialNumber', 'assetTag'] as const) {
          if (typeof payload[f] !== 'string' || !(payload[f] as string).trim()) reject(`Missing inventory field '${f}'`);
        }
      }
      const next: Record<string, unknown> = current
        ? { ...current }
        : {
            id: m.entityId,
            siteId: payload.siteId,
            equipmentType: payload.equipmentType,
            model: payload.model,
            serialNumber: payload.serialNumber,
            assetTag: payload.assetTag,
            condition: 'GOOD',
            status: 'INSTALLED',
          };
      for (const f of INVENTORY_SYNC_FIELDS) {
        if (f in payload) next[f] = typeof payload[f] === 'string' ? (payload[f] as string).slice(0, 2000) : payload[f];
      }
      next.orgId = user.orgId;
      next.updatedAt = new Date().toISOString();
      next.updatedBy = user.uid;
      return next as InventoryItem & Record<string, unknown>;
    });
    await this.audit.record(user, `INVENTORY_${m.operation}`, 'INVENTORY', m.entityId, 'Synced from offline replica');
  }

  private async applyGeneric(
    user: AuthUser,
    collection: 'tickets' | 'photos' | 'tssr_approvals',
    m: Mutation,
    payload: Record<string, unknown>
  ) {
    if (!hasAnyPermission(user.role, GENERIC_WRITE_PERMISSIONS[collection])) {
      reject(`Not permitted to write ${collection}`);
    }
    if (m.operation === 'DELETE') {
      await this.store.delete(user.orgId, collection, m.entityId);
      return;
    }
    if (Buffer.byteLength(JSON.stringify(payload)) > MAX_DOC_BYTES) {
      reject(`${collection} record exceeds ${MAX_DOC_BYTES} bytes; upload binaries to Cloud Storage instead`);
    }
    const { id: _id, orgId: _org, ...data } = payload;
    await this.store.transact(user.orgId, collection, m.entityId, (current) => ({
      ...(current ?? {}),
      ...data,
      id: m.entityId,
      orgId: user.orgId,
      updatedAt: new Date().toISOString(),
      updatedBy: user.uid,
      ...(current ? {} : { createdBy: user.uid }),
    }));
  }
}
