import Dexie, { Table } from 'dexie';
import {
  WorkOrder,
  PhotoEvidence,
  InventoryItem,
  TroubleshootingTicket,
  TssrApprovalSheet,
  AuditLogItem,
} from '../types/fieldops';

export interface TssrApprovalRecord {
  id: string;
  data: TssrApprovalSheet;
  updatedAt: string;
  syncStatus: 'PENDING' | 'SYNCED' | 'FAILED';
}

export interface DexieSyncQueueItem {
  id: string;
  collectionName: 'work_orders' | 'photos' | 'tssr_approvals' | 'inventory' | 'tickets' | 'audit_logs';
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: any;
  timestamp: string;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  retryCount: number;
  lastError?: string;
}

export class FieldOpsDexieDB extends Dexie {
  workOrders!: Table<WorkOrder, string>;
  photos!: Table<PhotoEvidence, string>;
  tssrApprovals!: Table<TssrApprovalRecord, string>;
  inventory!: Table<InventoryItem, string>;
  tickets!: Table<TroubleshootingTicket, string>;
  syncQueue!: Table<DexieSyncQueueItem, string>;
  auditLogs!: Table<AuditLogItem, string>;

  constructor() {
    super('fieldops_mw_dexie_db');
    this.version(1).stores({
      workOrders: 'id, status, type, siteId, hopId, updatedAt, syncStatus',
      photos: 'id, sectionCode, siteId, timestamp, syncStatus',
      tssrApprovals: 'id, syncStatus, updatedAt',
      inventory: 'id, siteId, serialNumber, assetTag, status, syncStatus',
      tickets: 'id, hopId, siteId, status, syncStatus',
      syncQueue: 'id, collectionName, entityId, operation, timestamp, status, retryCount',
      auditLogs: 'id, action, timestamp, userId',
    });
  }
}

// Single instance of Dexie database
export const dexieDb = new FieldOpsDexieDB();

/**
 * Storage metrics and statistics for offline management.
 */
export async function getStorageMetrics(): Promise<{
  usageMb: number;
  quotaMb: number;
  percentageUsed: number;
  photoCount: number;
  pendingSyncCount: number;
}> {
  let usageMb = 0;
  let quotaMb = 0;
  let percentageUsed = 0;

  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      usageMb = estimate.usage ? Math.round((estimate.usage / (1024 * 1024)) * 100) / 100 : 0;
      quotaMb = estimate.quota ? Math.round((estimate.quota / (1024 * 1024)) * 100) / 100 : 0;
      if (quotaMb > 0) {
        percentageUsed = Math.round((usageMb / quotaMb) * 1000) / 10;
      }
    } catch (e) {
      console.warn('Storage estimate unavailable', e);
    }
  }

  const [photoCount, pendingSyncCount] = await Promise.all([
    dexieDb.photos.count(),
    dexieDb.syncQueue.where('status').equals('PENDING').count(),
  ]);

  return {
    usageMb,
    quotaMb,
    percentageUsed,
    photoCount,
    pendingSyncCount,
  };
}
