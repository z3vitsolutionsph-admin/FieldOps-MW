import { api } from './apiClient';
import { dexieDb, DexieSyncQueueItem } from './dexieDbService';
import { WorkOrder, TssrApprovalSheet } from '../types/fieldops';

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
  private pendingCount = 0;
  private failedCount = 0;
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
        this.refreshCounts().then(() => this.notify());
        this.triggerDebouncedSync();
      });
      window.addEventListener('offline', () => {
        this.isOnlineStatus = false;
        this.currentMessage = 'Offline: Local Dexie.js persistence active';
        this.refreshCounts().then(() => this.notify());
      });

      // Restore last sync time from localStorage
      this.lastSyncTime = localStorage.getItem('fieldops_last_firestore_sync');
      this.refreshCounts().then(() => this.notify());
    }
  }

  private async refreshCounts() {
    try {
      this.pendingCount = await dexieDb.syncQueue.where('status').equals('PENDING').count();
      this.failedCount = await dexieDb.syncQueue.where('status').equals('FAILED').count();
    } catch {
      // Dexie might be initializing
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    this.refreshCounts().then(() => listener(this.getState()));
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
      pendingCount: this.pendingCount,
      failedCount: this.failedCount,
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
    }
    this.refreshCounts().then(() => this.notify());
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

  public async queueMutation(
    collectionName: string,
    entityId: string,
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    payload?: any
  ): Promise<void> {
    const queueItem: DexieSyncQueueItem = {
      id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      collectionName: collectionName as any,
      entityId,
      operation,
      payload,
      timestamp: new Date().toISOString(),
      status: 'PENDING',
      retryCount: 0,
    };

    await dexieDb.syncQueue.add(queueItem);
    await this.refreshCounts();
    this.notify();

    if (this.isOnlineStatus) {
      this.triggerDebouncedSync();
    }
  }

  public async syncNow(): Promise<{ success: boolean; syncedCount: number; errors: string[] }> {
    if (this.isSyncing) {
      return { success: false, syncedCount: 0, errors: ['Sync already in progress'] };
    }

    if (!this.isOnlineStatus) {
      this.currentMessage = 'Offline: Changes queued in Dexie.js';
      await this.refreshCounts();
      this.notify();
      return { success: false, syncedCount: 0, errors: ['Offline'] };
    }

    // 1. Check the gateway first with fetch('/api/health/ready')
    try {
      const readyRes = await fetch('/api/health/ready');
      if (!readyRes.ok) {
        this.currentMessage = 'Sync gateway currently unavailable (503)';
        await this.refreshCounts();
        this.notify();
        return { success: false, syncedCount: 0, errors: ['Sync gateway not ready'] };
      }
    } catch {
      this.currentMessage = 'Cannot connect to sync gateway';
      await this.refreshCounts();
      this.notify();
      return { success: false, syncedCount: 0, errors: ['Sync gateway connection error'] };
    }

    this.isSyncing = true;
    this.currentMessage = 'Querying pending offline mutations...';
    await this.refreshCounts();
    this.notify();

    // 2. Send only PENDING queue items, oldest first
    const pendingItems = await dexieDb.syncQueue
      .where('status')
      .equals('PENDING')
      .sortBy('timestamp');

    if (pendingItems.length === 0) {
      this.isSyncing = false;
      this.lastSyncTime = new Date().toISOString();
      localStorage.setItem('fieldops_last_firestore_sync', this.lastSyncTime);
      await this.refreshCounts();
      this.currentMessage = this.failedCount > 0
        ? `0 synced, ${this.failedCount} need attention`
        : 'All offline records are synchronized';
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

    this.estimatedTotalBytes = photoItems.length * 1800000 + dataItems.length * 12000;
    this.estimatedBytesTransferred = 0;

    this.currentMessage = `Preparing batch: ${photoItems.length} photos, ${dataItems.length} data mutations...`;
    this.notify();

    let syncedCount = 0;
    let attentionCount = 0;
    const errors: string[] = [];

    // Slice into batches: data changes in batches of up to 50, photos one per request
    const batches: DexieSyncQueueItem[][] = [];
    let currentDataBatch: DexieSyncQueueItem[] = [];

    for (const item of pendingItems) {
      if (item.collectionName === 'photos') {
        if (currentDataBatch.length > 0) {
          batches.push(currentDataBatch);
          currentDataBatch = [];
        }
        batches.push([item]);
      } else {
        currentDataBatch.push(item);
        if (currentDataBatch.length === 50) {
          batches.push(currentDataBatch);
          currentDataBatch = [];
        }
      }
    }
    if (currentDataBatch.length > 0) {
      batches.push(currentDataBatch);
    }

    for (const batch of batches) {
      try {
        const batchPayload = {
          mutations: batch.map((item) => ({
            id: item.id,
            collectionName: item.collectionName,
            entityId: item.entityId,
            operation: item.operation,
            payload: item.payload,
          })),
        };

        const response = await api<{
          syncedCount: number;
          processedIds: string[];
          results: Array<{ id: string; status: 'APPLIED' | 'REJECTED' | 'CONFLICT'; error?: string }>;
        }>('/api/sync/batch', {
          method: 'POST',
          body: batchPayload,
        });

        for (const item of batch) {
          const res = response.results?.find((r) => r.id === item.id);
          const isPhoto = item.collectionName === 'photos';

          if (res?.status === 'APPLIED') {
            await this.markLocalItemSynced(item.collectionName, item.entityId);
            await dexieDb.syncQueue.delete(item.id);
            syncedCount++;

            if (isPhoto) {
              this.photoSyncedCount++;
              this.estimatedBytesTransferred += 1800000;
            } else {
              this.dataSyncedCount++;
              this.estimatedBytesTransferred += 12000;
            }
          } else if (res?.status === 'REJECTED' || res?.status === 'CONFLICT') {
            // REJECTED or CONFLICT → set the queue item to FAILED with lastError (do not keep retrying)
            const errMsg = res.error || `Sync ${res.status.toLowerCase()}`;
            errors.push(`${item.collectionName}/${item.entityId}: ${errMsg}`);
            attentionCount++;
            await dexieDb.syncQueue.update(item.id, {
              status: 'FAILED',
              lastError: errMsg,
            });
          } else {
            const errMsg = res?.error || 'Rejected by server sync gateway';
            errors.push(`${item.collectionName}/${item.entityId}: ${errMsg}`);
            attentionCount++;
            await dexieDb.syncQueue.update(item.id, {
              status: 'FAILED',
              lastError: errMsg,
            });
          }

          this.syncedItemsCount = syncedCount;
          this.totalProgressPercent = Math.round((syncedCount / this.totalItemsToSync) * 100);
          this.photoProgressPercent =
            this.photoTotalCount > 0 ? Math.round((this.photoSyncedCount / this.photoTotalCount) * 100) : 100;
          this.dataProgressPercent =
            this.dataTotalCount > 0 ? Math.round((this.dataSyncedCount / this.dataTotalCount) * 100) : 100;

          this.notify();
          await new Promise((r) => setTimeout(r, 10));
        }
      } catch (err: any) {
        // A network or auth error → keep it PENDING, increment retryCount, and mark it FAILED after 4 retries.
        const errMsg = err?.message || 'Network/auth error during batch sync';
        console.error('Batch sync network/auth failure:', err);
        errors.push(`Chunk sync failure: ${errMsg}`);

        for (const item of batch) {
          const nextRetry = (item.retryCount || 0) + 1;
          const willFail = nextRetry >= 4;
          if (willFail) {
            attentionCount++;
          }
          await dexieDb.syncQueue.update(item.id, {
            status: willFail ? 'FAILED' : 'PENDING',
            retryCount: nextRetry,
            lastError: errMsg,
          });
        }
      }
    }

    this.isSyncing = false;
    this.lastSyncTime = new Date().toISOString();
    localStorage.setItem('fieldops_last_firestore_sync', this.lastSyncTime);
    await this.refreshCounts();

    // Message format: "N synced, M need attention"
    const totalAttention = this.failedCount;
    this.currentMessage = `${syncedCount} synced, ${totalAttention} need attention`;
    this.lastError = errors.length > 0 ? errors[0] : null;

    this.notify();
    return { success: errors.length === 0, syncedCount, errors };
  }

  public async simulateBatchProgressDemo(photosCount = 3, dataCount = 5) {
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.totalItemsToSync = photosCount + dataCount;
    this.photoTotalCount = photosCount;
    this.dataTotalCount = dataCount;
    this.syncedItemsCount = 0;
    this.photoSyncedCount = 0;
    this.dataSyncedCount = 0;
    this.totalProgressPercent = 0;
    this.estimatedTotalBytes = photosCount * 2100000 + dataCount * 14000;
    this.estimatedBytesTransferred = 0;

    for (let i = 0; i < dataCount; i++) {
      this.activeItemCategory = 'DATA';
      this.activeItemName = `work_orders/wo-2026-crane-${i + 1}`;
      this.currentMessage = `Synchronizing telemetry record [${i + 1}/${dataCount}]`;
      this.notify();
      await new Promise((r) => setTimeout(r, 120));
      this.dataSyncedCount++;
      this.syncedItemsCount++;
      this.totalProgressPercent = Math.round((this.syncedItemsCount / this.totalItemsToSync) * 100);
      this.notify();
    }

    for (let p = 0; p < photosCount; p++) {
      this.activeItemCategory = 'PHOTO';
      this.activeItemName = `Photo_TSSR_Gate_${p + 1}.jpg`;
      this.currentMessage = `Uploading Photo Evidence [${p + 1}/${photosCount}]`;
      this.notify();
      await new Promise((r) => setTimeout(r, 200));
      this.photoSyncedCount++;
      this.syncedItemsCount++;
      this.totalProgressPercent = Math.round((this.syncedItemsCount / this.totalItemsToSync) * 100);
      this.notify();
    }

    this.isSyncing = false;
    this.lastSyncTime = new Date().toISOString();
    this.currentMessage = 'All offline items synchronized successfully';
    await this.refreshCounts();
    this.notify();
  }

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

  public async pullFromFirestore(): Promise<{ pulledCount: number; message: string }> {
    if (!this.isOnlineStatus) {
      return { pulledCount: 0, message: 'Offline' };
    }

    try {
      let count = 0;

      // Query active mutations to skip any entity that has PENDING or SYNCING local changes
      const activeQueueItems = await dexieDb.syncQueue
        .where('status')
        .anyOf(['PENDING', 'SYNCING'])
        .toArray();
      const activeEntityIds = new Set(activeQueueItems.map((i) => i.entityId));

      // 1. Pull work orders via secured backend API
      const remoteWorkOrders = await api<WorkOrder[]>('/api/work-orders');
      if (Array.isArray(remoteWorkOrders)) {
        for (const remoteWo of remoteWorkOrders) {
          if (activeEntityIds.has(remoteWo.id)) {
            // Skip entity with pending local changes
            continue;
          }

          const local = await dexieDb.workOrders.get(remoteWo.id);
          const remoteVer = remoteWo.version ?? 0;
          const localVer = local?.version ?? 0;

          // Overwrite local work order only if the remote version or updatedAt is newer
          const isRemoteNewer =
            !local ||
            remoteVer > localVer ||
            (Boolean(remoteWo.updatedAt) && (!local.updatedAt || remoteWo.updatedAt! > local.updatedAt));

          if (isRemoteNewer) {
            await dexieDb.workOrders.put({ ...remoteWo, syncStatus: 'SYNCED' });
            count++;
          }
        }
      }

      // 2. Pull TSSR Approvals
      const remoteApprovals = await api<TssrApprovalSheet[]>('/api/tssr-approvals');
      if (Array.isArray(remoteApprovals)) {
        for (const approval of remoteApprovals) {
          const approvalId = (approval as any).id || 'active_sheet';
          if (activeEntityIds.has(approvalId)) {
            continue;
          }

          await dexieDb.tssrApprovals.put({
            id: approvalId,
            data: approval,
            updatedAt: new Date().toISOString(),
            syncStatus: 'SYNCED',
          });
          count++;
        }
      }

      this.lastSyncTime = new Date().toISOString();
      localStorage.setItem('fieldops_last_firestore_sync', this.lastSyncTime);
      await this.refreshCounts();
      this.notify();
      return { pulledCount: count, message: `Updated ${count} records from server` };
    } catch (err: any) {
      console.warn('Pull from server error:', err);
      return { pulledCount: 0, message: err?.message || 'Pull error' };
    }
  }
}

export const firestoreSync = new FirestoreSyncService();
