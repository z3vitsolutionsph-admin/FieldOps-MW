import {
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  collection,
} from 'firebase/firestore';
import { db, testFirestoreConnection } from './firebaseConfig';
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
      this.currentMessage = 'Offline: Unable to reach Firestore';
      this.notify();
      return { success: false, syncedCount: 0, errors: ['Network offline'] };
    }

    this.isSyncing = true;
    this.currentMessage = 'Reconciling connection & local Dexie queue...';
    this.notify();

    const isConnected = await testFirestoreConnection();
    if (!isConnected) {
      this.isSyncing = false;
      this.currentMessage = 'Firestore connection unavailable';
      this.notify();
      return { success: false, syncedCount: 0, errors: ['Firestore unreachable'] };
    }

    const pendingItems = await dexieDb.syncQueue
      .where('status')
      .anyOf(['PENDING', 'FAILED'])
      .toArray();

    if (pendingItems.length === 0) {
      this.isSyncing = false;
      this.lastSyncTime = new Date().toISOString();
      localStorage.setItem('fieldops_last_firestore_sync', this.lastSyncTime);
      this.currentMessage = 'All offline queue items are synchronized';
      this.totalProgressPercent = 100;
      this.photoProgressPercent = 100;
      this.dataProgressPercent = 100;
      this.notify();
      return { success: true, syncedCount: 0, errors: [] };
    }

    // Partition into photos vs data synchronizations
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

    // Estimate bytes (average ~1.8MB per photo evidence payload, ~12KB per data mutation)
    this.estimatedTotalBytes = photoItems.length * 1800000 + dataItems.length * 12000;
    this.estimatedBytesTransferred = 0;

    this.currentMessage = `Preparing batch: ${photoItems.length} photos, ${dataItems.length} data mutations...`;
    this.notify();

    let syncedCount = 0;
    const errors: string[] = [];

    // Process all pending items with progressive telemetry updates
    for (let i = 0; i < pendingItems.length; i++) {
      const item = pendingItems[i];
      const isPhoto = item.collectionName === 'photos';
      this.activeItemCategory = isPhoto ? 'PHOTO' : 'DATA';

      const entityName = isPhoto
        ? (item.payload?.title || item.payload?.category || `Photo_${item.entityId.slice(-6)}.jpg`)
        : `${item.collectionName} (${item.entityId})`;
      this.activeItemName = entityName;

      this.currentMessage = isPhoto
        ? `Uploading Photo Evidence [${this.photoSyncedCount + 1}/${this.photoTotalCount}]: ${entityName}`
        : `Synchronizing Record [${this.dataSyncedCount + 1}/${this.dataTotalCount}]: ${entityName}`;
      this.notify();

      try {
        const docRef = doc(db, item.collectionName, item.entityId);

        if (item.operation === 'DELETE') {
          await deleteDoc(docRef);
        } else {
          // Clean payload of undefined values which Firestore rejects
          const cleanPayload = item.payload ? JSON.parse(JSON.stringify(item.payload)) : {};
          await setDoc(docRef, cleanPayload, { merge: true });
        }

        // Mark local item as SYNCED in respective Dexie table
        await this.markLocalItemSynced(item.collectionName, item.entityId);

        // Delete processed item from syncQueue
        await dexieDb.syncQueue.delete(item.id);

        syncedCount++;
        this.syncedItemsCount = syncedCount;
        this.totalProgressPercent = Math.round((syncedCount / this.totalItemsToSync) * 100);

        if (isPhoto) {
          this.photoSyncedCount++;
          this.photoProgressPercent = Math.round((this.photoSyncedCount / this.photoTotalCount) * 100);
          this.estimatedBytesTransferred += 1800000;
        } else {
          this.dataSyncedCount++;
          this.dataProgressPercent = Math.round((this.dataSyncedCount / this.dataTotalCount) * 100);
          this.estimatedBytesTransferred += 12000;
        }

        this.notify();
        // Brief pacing delay (40ms) to ensure UI reflects smooth frame animation
        await new Promise((r) => setTimeout(r, 40));
      } catch (err: any) {
        console.error(`Sync failed for item ${item.id}:`, err);
        const errMsg = err?.message || 'Unknown Firestore write error';
        errors.push(`${item.collectionName}/${item.entityId}: ${errMsg}`);

        // Update retry count and status in Dexie
        await dexieDb.syncQueue.update(item.id, {
          status: item.retryCount >= 4 ? 'FAILED' : 'PENDING',
          retryCount: item.retryCount + 1,
          lastError: errMsg,
        });
      }
    }

    this.isSyncing = false;
    this.lastSyncTime = new Date().toISOString();
    localStorage.setItem('fieldops_last_firestore_sync', this.lastSyncTime);
    this.lastError = errors.length > 0 ? errors[0] : null;
    this.totalProgressPercent = 100;
    this.currentMessage =
      errors.length > 0
        ? `Batch completed: ${syncedCount} synced, ${errors.length} failed`
        : `Successfully synchronized ${syncedCount} offline items to Firestore`;

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
      // 1. Pull work orders
      const woSnapshot = await getDocs(collection(db, 'work_orders'));
      for (const d of woSnapshot.docs) {
        const remoteWo = d.data() as WorkOrder;
        const local = await dexieDb.workOrders.get(remoteWo.id);
        if (!local || (remoteWo.updatedAt && (!local.updatedAt || remoteWo.updatedAt > local.updatedAt))) {
          await dexieDb.workOrders.put({ ...remoteWo, syncStatus: 'SYNCED' });
          count++;
        }
      }

      // 2. Pull TSSR Approvals
      const tssrSnapshot = await getDocs(collection(db, 'tssr_approvals'));
      for (const d of tssrSnapshot.docs) {
        const remoteApprovals = d.data() as TssrApprovalSheet;
        await dexieDb.tssrApprovals.put({
          id: d.id,
          data: remoteApprovals,
          updatedAt: new Date().toISOString(),
          syncStatus: 'SYNCED',
        });
        count++;
      }

      this.lastSyncTime = new Date().toISOString();
      localStorage.setItem('fieldops_last_firestore_sync', this.lastSyncTime);
      this.notify();
      return { pulledCount: count, message: `Updated ${count} records from cloud` };
    } catch (err: any) {
      console.warn('Pull from Firestore error:', err);
      return { pulledCount: 0, message: err?.message || 'Pull error' };
    }
  }
}

export const firestoreSync = new FirestoreSyncService();
