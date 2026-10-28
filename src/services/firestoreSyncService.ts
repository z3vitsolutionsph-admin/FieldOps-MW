import { api, ApiError } from './apiClient';
import { dexieDb, DexieSyncQueueItem } from './dexieDbService';
import {
  WorkOrder,
  TssrApprovalSheet,
} from '../types/fieldops';

export interface SyncStatusState {
  isSyncing: boolean;
  isOnline: boolean;
  lastSyncTimestamp: string | null;
  currentMessage: string;
  pendingCount: number;
  failedCount: number;
  lastError: string | null;
  // Visual batch progress metrics
  totalItemsToSync: number;
  syncedItemsCount: number;
  totalProgressPercent: number; // 0 to 100
  photoTotalCount: number;
  photoSyncedCount: number;
  photoProgressPercent: number; // 0 to 100
  dataTotalCount: number;
  dataSyncedCount: number;
  dataProgressPercent: number; // 0 to 100
  activeItemName?: string;
  activeItemCategory?: 'PHOTO' | 'DATA';
  estimatedBytesTransferred?: number;
  estimatedTotalBytes?: number;
}

type SyncListener = (state: SyncStatusState) => void;

class FirestoreSyncService {
  private isSyncing = false;
  private isOnlineStatus = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private lastSyncTime: string | null = null;
  private currentMessage = 'Idle';
  private lastError: string | null = null;
  private listeners: Set<SyncListener> = new Set();
  private syncDebounceTimer: any = null;

  // Batch progress tracking state
  private totalItemsToSync = 0;
  private syncedItemsCount = 0;
  private totalProgressPercent = 0;
  private photoTotalCount = 0;
  private photoSyncedCount = 0;
  private photoProgressPercent = 0;
  private dataTotalCount = 0;
  private dataSyncedCount = 0;
  private dataProgressPercent = 0;
  private activeItemName = '';
  private activeItemCategory: 'PHOTO' | 'DATA' = 'DATA';
  private estimatedBytesTransferred = 0;
  private estimatedTotalBytes = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnlineStatus = true;
        this.notify();
        this.triggerDebouncedSync();
      });
      window.addEventListener('offline', () => {
        this.isOnlineStatus = false;
        this.currentMessage = 'Offline: Local Dexie.js persistence active';
        this.notify();
      });

      // Restore last sync time from localStorage
      this.lastSyncTime = localStorage.getItem('fieldops_last_firestore_sync');
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((cb) => cb(state));
  }

  public getState(): SyncStatusState {
    return {
      isSyncing: this.isSyncing,
      isOnline: this.isOnlineStatus,
      lastSyncTimestamp: this.lastSyncTime,
      currentMessage: this.currentMessage,
      pendingCount: this.totalItemsToSync - this.syncedItemsCount,
      failedCount: 0,
      lastError: this.lastError,
      totalItemsToSync: this.totalItemsToSync,
      syncedItemsCount: this.syncedItemsCount,
      totalProgressPercent: this.totalProgressPercent,
      photoTotalCount: this.photoTotalCount,
      photoSyncedCount: this.photoSyncedCount,
      photoProgressPercent: this.photoProgressPercent,
      dataTotalCount: this.dataTotalCount,
      dataSyncedCount: this.dataSyncedCount,
      dataProgressPercent: this.dataProgressPercent,
      activeItemName: this.activeItemName,
      activeItemCategory: this.activeItemCategory,
      estimatedBytesTransferred: this.estimatedBytesTransferred,
      estimatedTotalBytes: this.estimatedTotalBytes,
    };
  }

  public setOnlineStatus(online: boolean) {
    this.isOnlineStatus = online;
    if (online) {
      this.triggerDebouncedSync();
    } else {
      this.currentMessage = 'Offline: Working from local Dexie IndexedDB';
    }
    this.notify();
  }

  public isOnline(): boolean {
    return this.isOnlineStatus;
  }

  public triggerDebouncedSync() {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }
    this.syncDebounceTimer = setTimeout(() => {
      this.syncNow();
    }, 1500);
  }

  /**
   * Enqueue a mutation into Dexie's sync queue
   */
  public async queueMutation(
    collectionName: DexieSyncQueueItem['collectionName'],
    entityId: string,
    operation: DexieSyncQueueItem['operation'],
    payload: any
  ) {
    const queueItem: DexieSyncQueueItem = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      collectionName,
      entityId,
      operation,
      payload,
      timestamp: new Date().toISOString(),
      status: 'PENDING',
      retryCount: 0,
    };

    await dexieDb.syncQueue.put(queueItem);
    this.notify();

    if (this.isOnlineStatus) {
      this.triggerDebouncedSync();
    }
  }

  /**
   * Main synchronization executor: syncs pending mutations to Firestore with granular visual batch progress
   */
  public async syncNow(): Promise<{ success: boolean; syncedCount: number; errors: string[] }> {
    if (this.isSyncing) {
      return { success: false, syncedCount: 0, errors: ['Sync already in progress'] };
    }

    if (!this.isOnlineStatus) {
      this.currentMessage = 'Offline: changes are kept on this device';
      this.notify();
      return { success: false, syncedCount: 0, errors: ['Network offline'] };
    }

    this.isSyncing = true;
    this.currentMessage = 'Checking connection to the sync gateway...';
    this.notify();

    if (!(await isGatewayReachable())) {
      this.isSyncing = false;
      this.currentMessage = 'Sync gateway unavailable — will retry automatically';
      this.notify();
      return { success: false, syncedCount: 0, errors: ['Sync gateway unreachable'] };
    }

    // FAILED items were rejected or conflicted on the server; they need a person, not a retry loop.
    const pendingItems = await dexieDb.syncQueue.where('status').equals('PENDING').sortBy('timestamp');

    if (pendingItems.length === 0) {
      this.isSyncing = false;
      this.lastSyncTime = new Date().toISOString();
      localStorage.setItem('fieldops_last_firestore_sync', this.lastSyncTime);
      this.currentMessage = 'All offline changes are synchronized';
      this.totalProgressPercent = 100;
      this.photoProgressPercent = 100;
      this.dataProgressPercent = 100;
      this.notify();
      return { success: true, syncedCount: 0, errors: [] };
    }

    const photoItems = pendingItems.filter((i) => i.collectionName === 'photos');
    const dataItems = pendingItems.filter((i) => i.collectionName !== 'photos');

    this.totalItemsToSync = pendingItems.length;
    this.syncedItemsCount = 0;
    this.totalProgressPercent = 0;
    this.photoTotalCount = photoItems.length;
    this.photoSyncedCount = 0;
    this.photoProgressPercent = photoItems.length === 0 ? 100 : 0;
    this.dataTotalCount = dataItems.length;
    this.dataSyncedCount = 0;
    this.dataProgressPercent = dataItems.length === 0 ? 100 : 0;
    this.estimatedTotalBytes = pendingItems.reduce((n, i) => n + approxBytes(i.payload), 0);
    this.estimatedBytesTransferred = 0;

    this.currentMessage = `Preparing batch: ${photoItems.length} photos, ${dataItems.length} data changes...`;
    this.notify();

    let syncedCount = 0;
    const errors: string[] = [];

    // Data mutations travel in batches (order preserved); photos go one per request to stay under body limits.
    const chunks: DexieSyncQueueItem[][] = [];
    for (let i = 0; i < dataItems.length; i += DATA_BATCH_SIZE) chunks.push(dataItems.slice(i, i + DATA_BATCH_SIZE));
    for (const photo of photoItems) chunks.push([photo]);

    for (const chunk of chunks) {
      const isPhoto = chunk[0].collectionName === 'photos';
      this.activeItemCategory = isPhoto ? 'PHOTO' : 'DATA';
      this.activeItemName = isPhoto
        ? String(chunk[0].payload?.title || chunk[0].payload?.category || `Photo_${chunk[0].entityId.slice(-6)}.jpg`)
        : `${chunk.length} record change(s)`;
      this.currentMessage = isPhoto
        ? `Uploading photo [${this.photoSyncedCount + 1}/${this.photoTotalCount}]: ${this.activeItemName}`
        : `Synchronizing ${this.activeItemName}`;
      this.notify();

      try {
        const res = await api<{ results: SyncResult[] }>('/api/sync/batch', {
          method: 'POST',
          body: {
            mutations: chunk.map((item) => ({
              id: item.id,
              collectionName: item.collectionName,
              entityId: item.entityId,
              operation: item.operation,
              payload: item.payload ? JSON.parse(JSON.stringify(item.payload)) : null,
            })),
          },
        });
        const byId = new Map(res.results.map((r) => [r.id, r]));
        for (const item of chunk) {
          const result = byId.get(item.id);
          if (result?.status === 'APPLIED') {
            await this.markLocalItemSynced(item.collectionName, item.entityId);
            await dexieDb.syncQueue.delete(item.id);
            syncedCount++;
            if (isPhoto) this.photoSyncedCount++;
            else this.dataSyncedCount++;
          } else {
            const reason = result ? `${result.status}: ${result.error ?? 'rejected by server'}` : 'No result returned';
            errors.push(`${item.collectionName}/${item.entityId}: ${reason}`);
            await dexieDb.syncQueue.update(item.id, { status: 'FAILED', lastError: reason });
          }
          this.estimatedBytesTransferred += approxBytes(item.payload);
        }
      } catch (err) {
        // Transport/auth failure: keep items PENDING (bounded retries) so nothing recorded offline is lost.
        const errMsg = err instanceof ApiError ? `${err.status} ${err.message}` : (err as Error)?.message || 'Network error';
        for (const item of chunk) {
          errors.push(`${item.collectionName}/${item.entityId}: ${errMsg}`);
          await dexieDb.syncQueue.update(item.id, {
            status: item.retryCount >= MAX_RETRIES ? 'FAILED' : 'PENDING',
            retryCount: item.retryCount + 1,
            lastError: errMsg,
          });
        }
      }

      this.syncedItemsCount = syncedCount;
      this.totalProgressPercent = Math.round(((this.photoSyncedCount + this.dataSyncedCount) / this.totalItemsToSync) * 100);
      this.photoProgressPercent = this.photoTotalCount ? Math.round((this.photoSyncedCount / this.photoTotalCount) * 100) : 100;
      this.dataProgressPercent = this.dataTotalCount ? Math.round((this.dataSyncedCount / this.dataTotalCount) * 100) : 100;
      this.notify();
    }

    this.isSyncing = false;
    this.lastSyncTime = new Date().toISOString();
    localStorage.setItem('fieldops_last_firestore_sync', this.lastSyncTime);
    this.lastError = errors.length > 0 ? errors[0] : null;
    this.totalProgressPercent = 100;
    this.currentMessage =
      errors.length > 0
        ? `Batch completed: ${syncedCount} synced, ${errors.length} need attention`
        : `Synchronized ${syncedCount} offline changes`;

    this.notify();
    return { success: errors.length === 0, syncedCount, errors };
  }

  /**
   * Helper to simulate a progressive batched sync run (e.g. for testing & verifying visual progress UI)
   */
  public async simulateBatchProgressDemo(numPhotos = 4, numData = 6): Promise<void> {
    if (this.isSyncing) return;

    this.isSyncing = true;
    this.totalItemsToSync = numPhotos + numData;
    this.syncedItemsCount = 0;
    this.totalProgressPercent = 0;
    this.photoTotalCount = numPhotos;
    this.photoSyncedCount = 0;
    this.photoProgressPercent = 0;
    this.dataTotalCount = numData;
    this.dataSyncedCount = 0;
    this.dataProgressPercent = 0;
    this.estimatedTotalBytes = numPhotos * 2100000 + numData * 14000;
    this.estimatedBytesTransferred = 0;

    const photoNames = [
      'Site_A_ODU_Azimuth_Alignment_231.8deg.jpg',
      'Site_B_Feeder_Grounding_Kit_Inspection.jpg',
      'Tower_Mast_Torque_Verification_Markings.jpg',
      'Shelter_Rectifier_-48V_DC_Breaker_Tagout.jpg',
    ];

    const dataNames = [
      'work_orders (wo-crane-site-b) - Checklist Step 4 Completed',
      'troubleshooting_tickets (tkt-mw-alarm-002) - RSSI Calibrated',
      'inventory (inv-odu-11g-catangnan) - Asset S/N Scanned',
      'tssr_approvals (tssr-hop-001) - Civil Works Gate Verified',
      'work_orders (wo-catangnan-install) - Grounding Resistance 4.2Ω',
      'audit_logs (log_20261016_01) - Supervisor Pre-Climb Signoff',
    ];

    this.currentMessage = `Starting batch synchronization (${this.totalItemsToSync} items)...`;
    this.notify();
    await new Promise((r) => setTimeout(r, 200));

    // 1. Sync data mutations first
    for (let i = 0; i < numData; i++) {
      this.activeItemCategory = 'DATA';
      this.activeItemName = dataNames[i] || `data_record_${i + 1}`;
      this.currentMessage = `Synchronizing Data [${i + 1}/${numData}]: ${this.activeItemName}`;
      this.notify();
      await new Promise((r) => setTimeout(r, 180));

      this.dataSyncedCount++;
      this.dataProgressPercent = Math.round((this.dataSyncedCount / this.dataTotalCount) * 100);
      this.syncedItemsCount++;
      this.totalProgressPercent = Math.round((this.syncedItemsCount / this.totalItemsToSync) * 100);
      this.estimatedBytesTransferred += 14000;
      this.notify();
    }

    // 2. Sync photos
    for (let i = 0; i < numPhotos; i++) {
      this.activeItemCategory = 'PHOTO';
      this.activeItemName = photoNames[i] || `Photo_Evidence_${i + 1}.jpg`;
      this.currentMessage = `Uploading Batched Photo [${i + 1}/${numPhotos}]: ${this.activeItemName}`;
      this.notify();
      await new Promise((r) => setTimeout(r, 320));

      this.photoSyncedCount++;
      this.photoProgressPercent = Math.round((this.photoSyncedCount / this.photoTotalCount) * 100);
      this.syncedItemsCount++;
      this.totalProgressPercent = Math.round((this.syncedItemsCount / this.totalItemsToSync) * 100);
      this.estimatedBytesTransferred += 2100000;
      this.notify();
    }

    this.isSyncing = false;
    this.lastSyncTime = new Date().toISOString();
    this.totalProgressPercent = 100;
    this.photoProgressPercent = 100;
    this.dataProgressPercent = 100;
    this.currentMessage = `All ${this.totalItemsToSync} offline items synchronized successfully to Firestore`;
    this.notify();
  }

  /**
   * Update syncStatus flag on corresponding Dexie table record
   */
  private async markLocalItemSynced(collectionName: string, entityId: string) {
    try {
      if (collectionName === 'work_orders') {
        await dexieDb.workOrders.update(entityId, { syncStatus: 'SYNCED' });
      } else if (collectionName === 'photos') {
        await dexieDb.photos.update(entityId, { syncStatus: 'SYNCED' });
      } else if (collectionName === 'inventory') {
        await dexieDb.inventory.update(entityId, { syncStatus: 'SYNCED' });
      } else if (collectionName === 'tickets') {
        await dexieDb.tickets.update(entityId, { syncStatus: 'SYNCED' });
      } else if (collectionName === 'tssr_approvals') {
        await dexieDb.tssrApprovals.update(entityId, { syncStatus: 'SYNCED' });
      }
    } catch (e) {
      console.warn('Failed to update syncStatus in Dexie', e);
    }
  }

  /**
   * Pulls latest remote changes from Firestore to reconcile local Dexie store
   */
  public async pullFromFirestore(): Promise<{ pulledCount: number; message: string }> {
    if (!this.isOnlineStatus) {
      return { pulledCount: 0, message: 'Offline' };
    }

    try {
      let count = 0;
      const pendingIds = new Set(
        (await dexieDb.syncQueue.where('status').anyOf(['PENDING', 'SYNCING']).toArray()).map((q) => q.entityId)
      );

      // 1. Work orders the server lets this user see (already scoped by org and assignment)
      for (const remoteWo of await api<WorkOrder[]>('/api/work-orders')) {
        if (pendingIds.has(remoteWo.id)) continue; // never clobber unsynced local edits
        const local = await dexieDb.workOrders.get(remoteWo.id);
        if (!local || (remoteWo.version ?? 0) > (local.version ?? 0) || (remoteWo.updatedAt ?? '') > (local.updatedAt ?? '')) {
          await dexieDb.workOrders.put({ ...remoteWo, syncStatus: 'SYNCED' });
          count++;
        }
      }

      // 2. TSSR approval sheets
      for (const remote of await api<Array<TssrApprovalSheet & { id: string; updatedAt?: string }>>('/api/tssr-approvals')) {
        if (pendingIds.has(remote.id)) continue;
        await dexieDb.tssrApprovals.put({
          id: remote.id,
          data: remote,
          updatedAt: remote.updatedAt ?? new Date().toISOString(),
          syncStatus: 'SYNCED',
        });
        count++;
      }

      this.lastSyncTime = new Date().toISOString();
      localStorage.setItem('fieldops_last_firestore_sync', this.lastSyncTime);
      this.notify();
      return { pulledCount: count, message: `Updated ${count} records from cloud` };
    } catch (err: any) {
      console.warn('Pull from server error:', err);
      return { pulledCount: 0, message: err?.message || 'Pull error' };
    }
  }
}

interface SyncResult {
  id: string;
  status: 'APPLIED' | 'REJECTED' | 'CONFLICT';
  error?: string;
}

const DATA_BATCH_SIZE = 50;
const MAX_RETRIES = 4;

function approxBytes(payload: unknown): number {
  try {
    return payload ? JSON.stringify(payload).length : 0;
  } catch {
    return 0;
  }
}

async function isGatewayReachable(): Promise<boolean> {
  try {
    const res = await fetch('/api/health/ready', { cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

export const firestoreSync = new FirestoreSyncService();
