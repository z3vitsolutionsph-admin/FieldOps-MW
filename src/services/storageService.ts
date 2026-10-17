import {
  WorkOrder,
  PhotoEvidence,
  InventoryItem,
  TroubleshootingTicket,
  UserProfile,
  OfflineQueueItem,
  AuditLogItem,
  TssrApprovalSheet,
  InstallationStepData,
  Site,
  Hop,
  BatteryTelemetryPoint,
  ParsedTssrProjectData,
  ShiftHandoverLog,
} from '../types/fieldops';
import {
  SEED_WORK_ORDERS,
  SEED_INVENTORY,
  SEED_TICKETS,
  SEED_USERS,
  SEED_TSSR_APPROVALS,
  SEED_SITE_B,
  SEED_SITE_A,
  SEED_HOP,
} from '../data/seedData';
import { dexieDb, DexieSyncQueueItem } from './dexieDbService';
import { firestoreSync } from './firestoreSyncService';
import { batteryStorage } from './batteryStorageService';

const KEYS = {
  USERS: 'fieldops_users',
  ACTIVE_USER: 'fieldops_active_user',
  WORK_ORDERS: 'fieldops_work_orders',
  PHOTOS: 'fieldops_photos',
  INVENTORY: 'fieldops_inventory',
  TICKETS: 'fieldops_tickets',
  TSSR_APPROVALS: 'fieldops_tssr_approvals',
  AUDIT_LOGS: 'fieldops_audit_logs',
  SITES: 'fieldops_sites',
  HOPS: 'fieldops_hops',
  SUNLIGHT_MODE: 'fieldops_sunlight_mode',
  LANGUAGE: 'fieldops_language',
  ACTIVE_TSSR_PROJECT: 'fieldops_active_tssr_project',
};

class StorageService {
  private listeners: Set<() => void> = new Set();
  private isOnlineStatus: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // In-memory cache synced with Dexie.js IndexedDB
  private photosCache: PhotoEvidence[] = [];
  private workOrdersCache: WorkOrder[] = [];
  private queueCache: OfflineQueueItem[] = [];
  private inventoryCache: InventoryItem[] = [];
  private ticketsCache: TroubleshootingTicket[] = [];
  private tssrApprovalsCache: TssrApprovalSheet = SEED_TSSR_APPROVALS;
  private isDbHydrated: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnlineStatus = true;
        firestoreSync.setOnlineStatus(true);
        this.processQueue();
        this.notify();
      });
      window.addEventListener('offline', () => {
        this.isOnlineStatus = false;
        firestoreSync.setOnlineStatus(false);
        this.notify();
      });

      // Forward firestoreSync updates
      firestoreSync.subscribe(() => {
        this.refreshFromDexie().catch((e) => console.warn('Refresh error:', e));
      });

      this.initStorage();
    }
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  public isOnline(): boolean {
    return this.isOnlineStatus;
  }

  public setSimulatedOnline(online: boolean) {
    this.isOnlineStatus = online;
    firestoreSync.setOnlineStatus(online);
    if (online) {
      this.processQueue();
    }
    this.notify();
  }

  // Refresh in-memory cache directly from Dexie.js
  public async refreshFromDexie() {
    try {
      const [orders, photos, inv, tssrRecord, tickets, queueItems] = await Promise.all([
        dexieDb.workOrders.toArray(),
        dexieDb.photos.toArray(),
        dexieDb.inventory.toArray(),
        dexieDb.tssrApprovals.get('active_sheet'),
        dexieDb.tickets.toArray(),
        dexieDb.syncQueue.toArray(),
      ]);

      if (orders.length > 0) this.workOrdersCache = orders;
      if (photos.length > 0) this.photosCache = photos;
      if (inv.length > 0) this.inventoryCache = inv;
      if (tssrRecord?.data) this.tssrApprovalsCache = tssrRecord.data;
      if (tickets.length > 0) this.ticketsCache = tickets;

      // Map Dexie syncQueue to backward compatible queueCache
      this.queueCache = queueItems.map((q) => ({
        id: q.id,
        action: `${q.operation}_${q.collectionName.toUpperCase()}`,
        payload: q.payload,
        timestamp: q.timestamp,
        retryCount: q.retryCount,
      }));

      this.notify();
    } catch (err) {
      console.warn('refreshFromDexie failed:', err);
    }
  }

  // Hydrate in-memory cache from Dexie.js IndexedDB
  private async initStorage() {
    // 0. Ensure all previously uploaded TSSR data is removed to test fresh AI ingestion
    if (!localStorage.getItem('fieldops_tssr_purged_for_ai_test_v1')) {
      localStorage.removeItem(KEYS.ACTIVE_TSSR_PROJECT);
      localStorage.setItem(KEYS.SITES, JSON.stringify([]));
      localStorage.setItem(KEYS.HOPS, JSON.stringify([]));
      localStorage.setItem(KEYS.WORK_ORDERS, JSON.stringify([]));
      localStorage.setItem('fieldops_tssr_purged_for_ai_test_v1', 'true');
    }

    // 1. Initial user & sites check in localStorage for fast bootstrap
    if (!localStorage.getItem(KEYS.USERS)) {
      localStorage.setItem(KEYS.USERS, JSON.stringify(SEED_USERS));
    }
    if (!localStorage.getItem(KEYS.ACTIVE_USER)) {
      const pmUser = SEED_USERS.find((u) => u.role === 'PROJECT_MANAGER') || SEED_USERS[0];
      localStorage.setItem(KEYS.ACTIVE_USER, JSON.stringify(pmUser));
    }

    // 2. Load and seed Dexie.js IndexedDB tables
    try {
      const activeProject = this.getActiveTssrProject();
      const [invCount, photoList, tssrRecord, ticketList, queueItems] = await Promise.all([
        dexieDb.inventory.count(),
        dexieDb.photos.toArray(),
        dexieDb.tssrApprovals.get('active_sheet'),
        dexieDb.tickets.toArray(),
        dexieDb.syncQueue.toArray(),
      ]);

      if (!activeProject) {
        // CLEAN UNSEEDED STATE: No TSSR is uploaded yet
        localStorage.setItem(KEYS.SITES, JSON.stringify([]));
        localStorage.setItem(KEYS.HOPS, JSON.stringify([]));
        localStorage.setItem(KEYS.WORK_ORDERS, JSON.stringify([]));
        this.workOrdersCache = [];
        await dexieDb.workOrders.clear();
      } else {
        // Active TSSR exists: load its work orders
        const count = await dexieDb.workOrders.count();
        if (count > 0) {
          this.workOrdersCache = await dexieDb.workOrders.toArray();
        } else if (activeProject.generatedWorkOrders && activeProject.generatedWorkOrders.length > 0) {
          this.workOrdersCache = activeProject.generatedWorkOrders;
          await dexieDb.workOrders.bulkPut(activeProject.generatedWorkOrders);
        }
      }

      // Seed Inventory in Dexie if first run
      if (invCount === 0) {
        await dexieDb.inventory.bulkPut(SEED_INVENTORY);
        this.inventoryCache = [...SEED_INVENTORY];
      } else {
        this.inventoryCache = await dexieDb.inventory.toArray();
      }

      // Seed TSSR Approvals in Dexie if first run
      if (!tssrRecord) {
        await dexieDb.tssrApprovals.put({
          id: 'active_sheet',
          data: SEED_TSSR_APPROVALS,
          updatedAt: new Date().toISOString(),
          syncStatus: 'SYNCED',
        });
        this.tssrApprovalsCache = SEED_TSSR_APPROVALS;
      } else {
        this.tssrApprovalsCache = tssrRecord.data;
      }

      // Seed Tickets
      if (ticketList.length === 0) {
        await dexieDb.tickets.bulkPut(SEED_TICKETS);
        this.ticketsCache = [...SEED_TICKETS];
      } else {
        this.ticketsCache = ticketList;
      }

      this.photosCache = photoList;
      this.queueCache = queueItems.map((q) => ({
        id: q.id,
        action: `${q.operation}_${q.collectionName.toUpperCase()}`,
        payload: q.payload,
        timestamp: q.timestamp,
        retryCount: q.retryCount,
      }));
      this.isDbHydrated = true;

      this.notify();

      // If online on initial boot, attempt initial sync / pull
      if (this.isOnlineStatus) {
        firestoreSync.triggerDebouncedSync();
      }
    } catch (err) {
      console.warn('Failed to hydrate from Dexie.js, falling back to localStorage:', err);
      const rawWo = localStorage.getItem(KEYS.WORK_ORDERS);
      this.workOrdersCache = rawWo ? JSON.parse(rawWo) : SEED_WORK_ORDERS;
      const rawPhotos = localStorage.getItem(KEYS.PHOTOS);
      this.photosCache = rawPhotos ? JSON.parse(rawPhotos) : [];
      this.isDbHydrated = true;
    }
  }

  // Active User / Auth
  public getActiveUser(): UserProfile {
    const raw = localStorage.getItem(KEYS.ACTIVE_USER);
    if (raw) return JSON.parse(raw);
    return SEED_USERS[0];
  }

  public setActiveUser(user: UserProfile) {
    localStorage.setItem(KEYS.ACTIVE_USER, JSON.stringify(user));
    this.logAudit('USER_SWITCH', user.id, 'User', `Switched active role to ${user.role} (${user.name})`);
    this.notify();
  }

  public getAllUsers(): UserProfile[] {
    const raw = localStorage.getItem(KEYS.USERS);
    return raw ? JSON.parse(raw) : SEED_USERS;
  }

  // Work Orders (Permanent in Dexie.js IndexedDB & Synced with Firestore)
  public getWorkOrders(): WorkOrder[] {
    return this.workOrdersCache;
  }

  public getWorkOrderById(id: string): WorkOrder | undefined {
    return this.getWorkOrders().find((o) => o.id === id);
  }

  public async saveWorkOrder(wo: WorkOrder) {
    const orders = this.getWorkOrders();
    const idx = orders.findIndex((o) => o.id === wo.id);
    const updatedWo: WorkOrder = {
      ...wo,
      updatedAt: new Date().toISOString(),
      syncStatus: this.isOnline() ? 'SYNCED' : 'QUEUED',
    };

    if (idx >= 0) {
      orders[idx] = updatedWo;
    } else {
      orders.push(updatedWo);
    }
    this.workOrdersCache = [...orders];

    // Persist permanently in Dexie.js IndexedDB
    await dexieDb.workOrders.put(updatedWo);
    localStorage.setItem(KEYS.WORK_ORDERS, JSON.stringify(orders));

    // Queue Firestore mutation
    await firestoreSync.queueMutation('work_orders', updatedWo.id, 'UPDATE', updatedWo);

    // Keep legacy queueCache in sync
    this.queueCache = [
      ...this.queueCache,
      {
        id: 'q_wo_' + Date.now(),
        action: 'UPDATE_WORK_ORDER',
        payload: updatedWo,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      },
    ];

    this.notify();
  }

  public updateStepData(
    woId: string,
    stepIndex: number,
    data: Record<string, any>,
    completed: boolean = true,
    notes?: string
  ) {
    const wo = this.getWorkOrderById(woId);
    if (!wo) return;
    const user = this.getActiveUser();

    const existingStep = wo.stepsData[stepIndex] || {
      stepIndex,
      completed: false,
      data: {},
    };

    const updatedStep: InstallationStepData = {
      ...existingStep,
      completed,
      completedAt: completed ? new Date().toISOString() : undefined,
      completedBy: completed ? user.name : undefined,
      data: { ...existingStep.data, ...data },
      notes: notes ?? existingStep.notes,
    };

    wo.stepsData[stepIndex] = updatedStep;
    if (completed && wo.currentStepIndex === stepIndex && stepIndex < 10) {
      wo.currentStepIndex = stepIndex + 1;
    }

    wo.history.push({
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      action: `STEP_${stepIndex}_${completed ? 'COMPLETED' : 'SAVED'}`,
      note: notes || `Step ${stepIndex + 1} updated`,
    });

    this.saveWorkOrder(wo);
    this.logAudit(
      'STEP_SAVED',
      woId,
      'WorkOrder',
      `Step ${stepIndex + 1} saved in Dexie.js by ${user.name} (${completed ? 'Completed' : 'Draft'})`
    );
  }

  // Shift Handover Log Management
  public async addShiftHandoverLog(
    woId: string,
    logData: Omit<ShiftHandoverLog, 'id' | 'timestamp' | 'departingTechnicianId' | 'departingTechnicianName' | 'departingRole'>
  ): Promise<ShiftHandoverLog | undefined> {
    const wo = this.getWorkOrderById(woId);
    if (!wo) return;
    const user = this.getActiveUser();

    const fullLog: ShiftHandoverLog = {
      ...logData,
      id: `shift_log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      workOrderId: woId,
      workOrderNumber: wo.workOrderNumber,
      timestamp: new Date().toISOString(),
      departingTechnicianId: user.id,
      departingTechnicianName: user.name,
      departingRole: user.role,
    };

    const existingHandovers = wo.shiftHandovers || [];
    const updatedWo: WorkOrder = {
      ...wo,
      shiftHandovers: [fullLog, ...existingHandovers],
      history: [
        ...(wo.history || []),
        {
          timestamp: new Date().toISOString(),
          userId: user.id,
          userName: user.name,
          action: 'SHIFT_HANDOVER_RECORDED',
          note: `Shift Handover (${fullLog.shiftType.replace('_', ' ')}): Status - ${fullLog.statusSummary}. ${fullLog.remainingTasks.length} pending task(s) for incoming shift. Signed: ${fullLog.departingSignature}`,
        },
      ],
    };

    await this.saveWorkOrder(updatedWo);
    this.logAudit(
      'SHIFT_HANDOVER',
      woId,
      'WORK_ORDER',
      `Technician ${user.name} recorded shift handover on ${wo.workOrderNumber}. Remaining tasks: ${fullLog.remainingTasks.length}`
    );
    this.notify();
    return fullLog;
  }

  public async acknowledgeShiftHandover(
    woId: string,
    logId: string,
    acknowledgementNotes?: string
  ): Promise<void> {
    const wo = this.getWorkOrderById(woId);
    if (!wo || !wo.shiftHandovers) return;
    const user = this.getActiveUser();

    const updatedHandovers = wo.shiftHandovers.map((h) => {
      if (h.id === logId) {
        return {
          ...h,
          incomingAcknowledgement: {
            acknowledgedAt: new Date().toISOString(),
            technicianName: user.name,
            technicianRole: user.role,
            notes: acknowledgementNotes || 'Acknowledged and accepted remaining tasks on-site.',
            signature: user.name,
          },
        };
      }
      return h;
    });

    const updatedWo: WorkOrder = {
      ...wo,
      shiftHandovers: updatedHandovers,
      history: [
        ...(wo.history || []),
        {
          timestamp: new Date().toISOString(),
          userId: user.id,
          userName: user.name,
          action: 'SHIFT_HANDOVER_ACKNOWLEDGED',
          note: `Incoming technician ${user.name} (${user.role.replace('_', ' ')}) acknowledged shift handover ${logId}.`,
        },
      ],
    };

    await this.saveWorkOrder(updatedWo);
    this.logAudit(
      'SHIFT_HANDOVER_ACK',
      woId,
      'WORK_ORDER',
      `Incoming technician ${user.name} accepted and acknowledged shift handover log on ${wo.workOrderNumber}`
    );
    this.notify();
  }

  public getShiftHandovers(woId?: string): ShiftHandoverLog[] {
    const orders = this.getWorkOrders();
    if (woId) {
      const wo = orders.find((o) => o.id === woId);
      return wo?.shiftHandovers || [];
    }
    const allLogs: ShiftHandoverLog[] = [];
    orders.forEach((o) => {
      if (o.shiftHandovers && o.shiftHandovers.length > 0) {
        allLogs.push(...o.shiftHandovers);
      }
    });
    return allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  // Sites & Hops
  public getSites(): Site[] {
    const raw = localStorage.getItem(KEYS.SITES);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public getSiteById(id: string): Site | undefined {
    return this.getSites().find((s) => s.id === id);
  }

  public getHops(): Hop[] {
    const raw = localStorage.getItem(KEYS.HOPS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public getHopById(id: string): Hop | undefined {
    return this.getHops().find((h) => h.id === id);
  }

  // Active TSSR Project Data uploaded by Project Manager
  public getActiveTssrProject(): ParsedTssrProjectData | null {
    const raw = localStorage.getItem(KEYS.ACTIVE_TSSR_PROJECT);
    return raw ? JSON.parse(raw) : null;
  }

  public hasActiveTssr(): boolean {
    return Boolean(this.getActiveTssrProject());
  }

  /**
   * Removes all data from the current TSSR uploaded, resetting the system
   * to a clean unseeded state to demonstrate AI extraction from scratch.
   */
  public async clearAllTssrUploadedData(): Promise<void> {
    localStorage.removeItem(KEYS.ACTIVE_TSSR_PROJECT);
    localStorage.setItem(KEYS.SITES, JSON.stringify([]));
    localStorage.setItem(KEYS.HOPS, JSON.stringify([]));
    localStorage.setItem(KEYS.WORK_ORDERS, JSON.stringify([]));
    this.workOrdersCache = [];

    try {
      await dexieDb.workOrders.clear();
    } catch (err) {
      console.warn('Failed to clear work orders from Dexie:', err);
    }

    this.logAudit(
      'TSSR_DATA_REMOVED',
      'SYS-RESET',
      'TSSR_PROJECT',
      'All TSSR data removed by Project Manager to reset system for fresh AI ingestion testing.'
    );

    this.notify();
  }

  public async saveTssrProject(projectData: ParsedTssrProjectData): Promise<void> {
    // 1. Update Regional Sites Directory
    const sites = [projectData.siteA, projectData.siteB];
    localStorage.setItem(KEYS.SITES, JSON.stringify(sites));

    // 2. Update Microwave Hop Geometry & RF link
    const hops = [projectData.hop];
    localStorage.setItem(KEYS.HOPS, JSON.stringify(hops));

    // 3. Save Active TSSR Project Snapshot
    localStorage.setItem(KEYS.ACTIVE_TSSR_PROJECT, JSON.stringify(projectData));

    // 4. Overwrite / Bind Work Orders Schedule
    if (projectData.generatedWorkOrders && projectData.generatedWorkOrders.length > 0) {
      this.workOrdersCache = [...projectData.generatedWorkOrders];
      localStorage.setItem(KEYS.WORK_ORDERS, JSON.stringify(this.workOrdersCache));
      try {
        await dexieDb.workOrders.clear();
        await dexieDb.workOrders.bulkPut(projectData.generatedWorkOrders);
      } catch (err) {
        console.warn('Failed to bulkPut work orders to Dexie:', err);
      }
    }

    this.logAudit(
      'TSSR_PROJECT_UPLOADED',
      projectData.projectCode,
      'TSSR_PROJECT',
      `TSSR project "${projectData.documentTitle}" uploaded by ${projectData.uploadedBy}. Synced Microwave Hop (${projectData.hop.hopName}), Regional Sites (${projectData.siteA.id} <-> ${projectData.siteB.id}), and ${projectData.generatedWorkOrders?.length || 0} Work Orders.`
    );

    this.notify();
  }

  // Photos (High-Capacity Dexie.js IndexedDB storage with Firestore sync)
  public getPhotos(siteId?: string, workOrderId?: string): PhotoEvidence[] {
    return this.photosCache.filter((p) => {
      if (siteId && p.siteId !== siteId) return false;
      if (workOrderId && p.workOrderId !== workOrderId) return false;
      return true;
    });
  }

  public async savePhoto(photo: PhotoEvidence) {
    const updatedPhoto: PhotoEvidence = {
      ...photo,
      syncStatus: this.isOnline() ? 'SYNCED' : 'QUEUED',
    };

    const photos = [...this.photosCache];
    const idx = photos.findIndex((p) => p.id === updatedPhoto.id);
    if (idx >= 0) {
      photos[idx] = updatedPhoto;
    } else {
      photos.push(updatedPhoto);
    }
    this.photosCache = photos;

    // Save image blob/dataUrl permanently into Dexie.js IndexedDB
    await dexieDb.photos.put(updatedPhoto);

    // Enqueue Firestore upload
    await firestoreSync.queueMutation('photos', updatedPhoto.id, 'CREATE', updatedPhoto);

    this.queueCache = [
      ...this.queueCache,
      {
        id: 'q_photo_' + Date.now(),
        action: 'UPLOAD_PHOTO',
        payload: {
          id: updatedPhoto.id,
          siteId: updatedPhoto.siteId,
          sectionCode: updatedPhoto.sectionCode,
          sectionTitle: updatedPhoto.sectionTitle,
          capturedAt: updatedPhoto.capturedAt,
        },
        timestamp: new Date().toISOString(),
        retryCount: 0,
      },
    ];

    this.logAudit(
      'PHOTO_SAVED',
      photo.id,
      'PhotoEvidence',
      `Captured ${photo.sectionCode} (${photo.sectionTitle}) saved in Dexie.js IndexedDB`
    );
    this.notify();
  }

  public markPhotoNa(
    siteId: string,
    sectionCode: string,
    sectionTitle: string,
    reason: string,
    workOrderId?: string
  ) {
    const user = this.getActiveUser();
    const photo: PhotoEvidence = {
      id: 'photo_na_' + sectionCode + '_' + Date.now(),
      orgId: user.orgId,
      siteId,
      workOrderId,
      sectionCode,
      sectionTitle,
      caption: `Marked N/A: ${reason}`,
      dataUrl: '',
      capturedAt: new Date().toISOString(),
      capturedBy: user.name,
      isNa: true,
      naReason: reason,
      syncStatus: this.isOnline() ? 'SYNCED' : 'QUEUED',
    };
    this.savePhoto(photo);
  }

  // Inventory (Dexie.js IndexedDB & Firestore)
  public getInventory(siteId?: string): InventoryItem[] {
    if (siteId) return this.inventoryCache.filter((i) => i.siteId === siteId);
    return this.inventoryCache;
  }

  public async saveInventoryItem(item: InventoryItem) {
    const updatedItem: InventoryItem = {
      ...item,
      syncStatus: this.isOnline() ? 'SYNCED' : 'QUEUED',
    };

    const items = [...this.inventoryCache];
    const idx = items.findIndex((i) => i.id === updatedItem.id);
    if (idx >= 0) {
      items[idx] = updatedItem;
    } else {
      items.push(updatedItem);
    }
    this.inventoryCache = items;

    await dexieDb.inventory.put(updatedItem);
    await firestoreSync.queueMutation('inventory', updatedItem.id, 'UPDATE', updatedItem);

    this.logAudit(
      'INVENTORY_UPDATE',
      item.id,
      'InventoryItem',
      `${item.equipmentType} (${item.serialNumber}) saved in Dexie.js`
    );
    this.notify();
  }

  // Troubleshooting Tickets (Dexie.js IndexedDB & Firestore)
  public getTickets(): TroubleshootingTicket[] {
    return this.ticketsCache;
  }

  public async saveTicket(ticket: TroubleshootingTicket) {
    const updatedTicket: TroubleshootingTicket = {
      ...ticket,
      syncStatus: this.isOnline() ? 'SYNCED' : 'QUEUED',
    };

    const tickets = [...this.ticketsCache];
    const idx = tickets.findIndex((t) => t.id === updatedTicket.id);
    if (idx >= 0) {
      tickets[idx] = updatedTicket;
    } else {
      tickets.unshift(updatedTicket);
    }
    this.ticketsCache = tickets;

    await dexieDb.tickets.put(updatedTicket);
    localStorage.setItem(KEYS.TICKETS, JSON.stringify(tickets));
    await firestoreSync.queueMutation('tickets', updatedTicket.id, 'CREATE', updatedTicket);

    this.logAudit(
      'TICKET_UPDATE',
      ticket.id,
      'TroubleshootingTicket',
      `Ticket ${ticket.ticketNumber} saved in Dexie.js`
    );
    this.notify();
  }

  // TSSR Approvals (Dexie.js IndexedDB & Firestore)
  public getTssrApprovals(): TssrApprovalSheet {
    return this.tssrApprovalsCache;
  }

  public async saveTssrApprovals(sheet: TssrApprovalSheet) {
    this.tssrApprovalsCache = sheet;

    await dexieDb.tssrApprovals.put({
      id: 'active_sheet',
      data: sheet,
      updatedAt: new Date().toISOString(),
      syncStatus: this.isOnline() ? 'SYNCED' : 'PENDING',
    });

    localStorage.setItem(KEYS.TSSR_APPROVALS, JSON.stringify(sheet));
    await firestoreSync.queueMutation('tssr_approvals', 'active_sheet', 'UPDATE', sheet);

    this.logAudit(
      'TSSR_APPROVALS_UPDATE',
      'tssr-approvals',
      'TssrApprovalSheet',
      'Routing sheet approvals saved in Dexie.js and queued for Firestore'
    );
    this.notify();
  }

  // Offline Sync Queue
  public getQueue(): OfflineQueueItem[] {
    return this.queueCache;
  }

  public async clearQueue() {
    this.queueCache = [];
    await dexieDb.syncQueue.clear();
    this.notify();
  }

  // Reliable sync upon network restoration
  public async processQueue() {
    await firestoreSync.syncNow();
    await this.refreshFromDexie();
  }

  // Audit Logs
  public getAuditLogs(): AuditLogItem[] {
    const raw = localStorage.getItem(KEYS.AUDIT_LOGS);
    return raw ? JSON.parse(raw) : [];
  }

  public async logAudit(action: string, targetId: string, targetType: string, details: string) {
    const user = this.getActiveUser();
    const item: AuditLogItem = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      orgId: user.orgId,
      userId: user.id,
      userName: user.name,
      action,
      targetId,
      targetType,
      details,
      timestamp: new Date().toISOString(),
    };

    // Store in Dexie
    await dexieDb.auditLogs.put(item).catch(() => {});

    const logs = this.getAuditLogs();
    logs.unshift(item);
    if (logs.length > 200) logs.pop();
    localStorage.setItem(KEYS.AUDIT_LOGS, JSON.stringify(logs));
  }

  // Sunlight Mode & Language Settings
  public getSunlightMode(): boolean {
    return localStorage.getItem(KEYS.SUNLIGHT_MODE) === 'true';
  }

  public setSunlightMode(enabled: boolean) {
    localStorage.setItem(KEYS.SUNLIGHT_MODE, enabled ? 'true' : 'false');
    this.notify();
  }

  public getLanguage(): 'EN' | 'FIL' {
    return (localStorage.getItem(KEYS.LANGUAGE) as 'EN' | 'FIL') || 'EN';
  }

  public setLanguage(lang: 'EN' | 'FIL') {
    localStorage.setItem(KEYS.LANGUAGE, lang);
    this.notify();
  }

  // Battery Telemetry & Discharge Curve Storage Cache
  public getBatteryTelemetry(siteId: string, timeframeHours: number = 24): BatteryTelemetryPoint[] {
    return batteryStorage.getTelemetry(siteId, timeframeHours);
  }

  public recordBatteryMeasurement(
    siteId: string,
    voltage: number,
    currentA?: number,
    soc?: number,
    tempC?: number
  ): BatteryTelemetryPoint {
    const res = batteryStorage.recordLiveMeasurement(siteId, voltage, currentA, soc, tempC);
    this.notify();
    return res;
  }

  public resetBatteryCurve(siteId: string): BatteryTelemetryPoint[] {
    const res = batteryStorage.resetToStandardCurve(siteId);
    this.notify();
    return res;
  }

  // Emergency edge storage flush
  public async flushToEdgeStorage(): Promise<void> {
    try {
      await Promise.all([
        dexieDb.workOrders.bulkPut(this.workOrdersCache),
        dexieDb.inventory.bulkPut(this.inventoryCache),
        dexieDb.tickets.bulkPut(this.ticketsCache),
      ]);
      this.logAudit('EMERGENCY_DATA_FLUSH', 'system', 'SYSTEM', 'Manual emergency flush executed before potential battery shutdown');
    } catch (e) {
      console.warn('flushToEdgeStorage warning:', e);
    }
  }
}

export const storage = new StorageService();
