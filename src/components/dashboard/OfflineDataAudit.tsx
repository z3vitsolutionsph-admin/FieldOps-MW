import React, { useState, useEffect, useMemo } from 'react';
import {
  Database,
  HardDrive,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Trash2,
  Filter,
  Search,
  Code,
  Copy,
  Check,
  UploadCloud,
  AlertCircle,
  ArrowRight,
  FileText,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Terminal,
  Download,
  Info,
  ShieldAlert,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { dexieDb, DexieSyncQueueItem, getStorageMetrics } from '../../services/dexieDbService';
import { firestoreSync, SyncStatusState } from '../../services/firestoreSyncService';
import { storage } from '../../services/storageService';

export interface QueuedAuditItem extends DexieSyncQueueItem {
  diagnosticInfo?: {
    category: 'NETWORK' | 'AUTH' | 'PAYLOAD' | 'CONCURRENCY' | 'VALIDATION' | 'UNKNOWN';
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    rootCause: string;
    fieldAction: string;
    telemetryHint?: string;
  };
}

interface OfflineDataAuditProps {
  sunlightMode?: boolean;
  onNavigateToOverview?: () => void;
}

export const OfflineDataAudit: React.FC<OfflineDataAuditProps> = ({
  sunlightMode = false,
  onNavigateToOverview,
}) => {
  const [queueItems, setQueueItems] = useState<QueuedAuditItem[]>([]);
  const [metrics, setMetrics] = useState<{
    usageMb: number;
    quotaMb: number;
    percentageUsed: number;
    photoCount: number;
    pendingSyncCount: number;
  } | null>(null);
  const [syncState, setSyncState] = useState<SyncStatusState>(firestoreSync.getState());
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [collectionFilter, setCollectionFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [expandedPayloadId, setExpandedPayloadId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isRetryingId, setIsRetryingId] = useState<string | null>(null);
  const [showSimulateModal, setShowSimulateModal] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Helper to diagnose errors and provide field technician guidance
  const diagnoseError = (errorMsg?: string): QueuedAuditItem['diagnosticInfo'] => {
    if (!errorMsg) return undefined;
    const lower = errorMsg.toLowerCase();

    if (
      lower.includes('timeout') ||
      lower.includes('network') ||
      lower.includes('fetch failed') ||
      lower.includes('connection') ||
      lower.includes('uplink') ||
      lower.includes('offline') ||
      lower.includes('408')
    ) {
      return {
        category: 'NETWORK',
        severity: 'CRITICAL',
        rootCause: 'Cellular Uplink Interruption / High Latency at Remote Tower Site',
        fieldAction:
          'Remote site 4G LTE signal is weak or shadowed by terrain. Relocate closer to the site shelter entrance or verify cellular antenna line-of-sight. If available, switch to site Wi-Fi or satellite terminal, then tap "Retry Upload".',
        telemetryHint: 'Recommended signal: RSRP > -105 dBm, SINR > 3 dB',
      };
    }

    if (
      lower.includes('permission') ||
      lower.includes('token') ||
      lower.includes('unauthorized') ||
      lower.includes('expired') ||
      lower.includes('auth') ||
      lower.includes('403')
    ) {
      return {
        category: 'AUTH',
        severity: 'CRITICAL',
        rootCause: 'Field Technician Credentials / Firestore Security Rule Lockout',
        fieldAction:
          'Security token expired during long off-grid work or insufficient RBAC privileges for this operation. Switch user identity in header or re-verify technician role before retrying upload.',
        telemetryHint: 'Verify valid JWT bearer token and assigned site role in RBAC manager',
      };
    }

    if (
      lower.includes('payload') ||
      lower.includes('large') ||
      lower.includes('blob') ||
      lower.includes('size') ||
      lower.includes('413')
    ) {
      return {
        category: 'PAYLOAD',
        severity: 'WARNING',
        rootCause: 'Photo Evidence Blob Exceeds Buffer Transmission Limit',
        fieldAction:
          'The captured image or panorama exceeds transmission buffer capacity. The photo is safely retained in local IndexedDB. Downsample image or upload via basecamp broadband.',
        telemetryHint: 'Target photo size: <= 3.5 MB per evidence frame',
      };
    }

    if (
      lower.includes('missing') ||
      lower.includes('required') ||
      lower.includes('invalid') ||
      lower.includes('validation')
    ) {
      return {
        category: 'VALIDATION',
        severity: 'WARNING',
        rootCause: 'Mandatory TSSR / Work Order Attribute Missing in Payload',
        fieldAction:
          'Cloud schema validation rejected the payload due to missing fields (e.g., GPS coordinates, Azimuth, or serial number). Inspect payload JSON below and complete missing step fields.',
        telemetryHint: 'Check sectionCode, gpsLat, gpsLong, and technician signature',
      };
    }

    if (
      lower.includes('conflict') ||
      lower.includes('aborted') ||
      lower.includes('revision') ||
      lower.includes('already exists')
    ) {
      return {
        category: 'CONCURRENCY',
        severity: 'WARNING',
        rootCause: 'Concurrent Revision Conflict with NOC / Remote Supervisor',
        fieldAction:
          'A remote user modified this record while working offline. Review the payload differences, tap "Pull Cloud Updates", and re-submit.',
        telemetryHint: 'Firestore document lock state: Optimistic concurrency collision',
      };
    }

    return {
      category: 'UNKNOWN',
      severity: 'WARNING',
      rootCause: 'Unspecified Firestore Protocol Exception',
      fieldAction:
        'Inspect raw error trace. If network is active, try retrying the item. If error persists, export diagnostics to dispatch NOC support.',
    };
  };

  // Seed sample items if Dexie queue is completely empty to provide instant diagnostic data
  const seedDefaultQueueIfEmpty = async () => {
    try {
      const count = await dexieDb.syncQueue.count();
      if (count === 0) {
        const now = Date.now();
        const initialItems: DexieSyncQueueItem[] = [
          {
            id: 'sync_err_candalaga_photo',
            collectionName: 'photos',
            entityId: 'photo-sec1.1-access-road-01',
            operation: 'CREATE',
            timestamp: new Date(now - 1000 * 60 * 14).toISOString(),
            status: 'FAILED',
            retryCount: 3,
            lastError:
              'HTTP 408 Request Timeout: 4G Cellular uplink dropped during 4.2MB high-resolution TSSR photo blob transmission at Mt. Candalaga site (RSRP -114 dBm, packet loss 84%)',
            payload: {
              id: 'photo-sec1.1-access-road-01',
              siteId: 'NS-TER25-A062',
              sectionCode: '1.1_ACCESS',
              sectionTitle: 'Access Road & Hauling Path',
              caption: 'Muddy access road steep grade - requires winch hauling gear',
              gpsLat: 7.5812,
              gpsLong: 126.1541,
              azimuthDeg: 61.02,
              capturedBy: 'Engr. D. Cruz',
              capturedAt: new Date(now - 1000 * 60 * 15).toISOString(),
              syncStatus: 'ERROR',
            },
          },
          {
            id: 'sync_err_wo_rules',
            collectionName: 'work_orders',
            entityId: 'wo-crane-site-a',
            operation: 'UPDATE',
            timestamp: new Date(now - 1000 * 60 * 32).toISOString(),
            status: 'FAILED',
            retryCount: 2,
            lastError:
              'PERMISSION_DENIED: Cloud Firestore security rules rejected update — technician session token expired during off-grid civil sign-off (JWT exp: 2026-10-11T05:00:00Z)',
            payload: {
              id: 'wo-crane-site-a',
              workOrderNumber: 'WO-MW-2026-0089',
              siteId: 'NS-TER25-A062',
              currentStepIndex: 3,
              status: 'IN_PROGRESS',
              tssrSnapshotVersion: 'v2.4-FINAL',
              signOff: {
                technicianName: 'Engr. D. Cruz',
                timestamp: new Date(now - 1000 * 60 * 33).toISOString(),
              },
            },
          },
          {
            id: 'sync_pend_inventory_ret',
            collectionName: 'inventory',
            entityId: 'inv-rtn-coupler-09',
            operation: 'UPDATE',
            timestamp: new Date(now - 1000 * 60 * 6).toISOString(),
            status: 'PENDING',
            retryCount: 0,
            payload: {
              id: 'inv-rtn-coupler-09',
              siteId: 'NS-TER25-A035',
              equipmentType: 'Coupler',
              serialNumber: 'SN-CPL-7719-B',
              assetTag: 'AST-DCO-8821',
              condition: 'GOOD',
              status: 'DISMANTLED_PENDING_RETURN',
              destinationWarehouse: 'Davao Regional Logistics Center',
              chainOfCustodySigner: 'Engr. J. Santos',
              syncStatus: 'QUEUED',
            },
          },
          {
            id: 'sync_pend_tssr_sheet',
            collectionName: 'tssr_approvals',
            entityId: 'active_sheet',
            operation: 'UPDATE',
            timestamp: new Date(now - 1000 * 60 * 4).toISOString(),
            status: 'PENDING',
            retryCount: 0,
            payload: {
              id: 'active_sheet',
              transportEng: {
                status: 'APPROVED',
                approverName: 'Engr. R. Morales (Transport Lead)',
                date: '2026-10-11',
                aclApprovedM: 45.0,
                legApproved: 'Leg B (North-East)',
                remarks: 'Verified 0.6m antenna clearance over existing microwave link dish',
              },
            },
          },
          {
            id: 'sync_ok_ticket_rsl',
            collectionName: 'tickets',
            entityId: 'tick-2026-0044',
            operation: 'CREATE',
            timestamp: new Date(now - 1000 * 60 * 55).toISOString(),
            status: 'SYNCED',
            retryCount: 1,
            payload: {
              id: 'tick-2026-0044',
              ticketNumber: 'TT-MW-2026-0044',
              hopId: 'HOP-TER-0089',
              siteId: 'NS-TER25-A035',
              symptom: 'LOW_RSL',
              severity: 'MAJOR',
              measuredRslDbm: -41.2,
              status: 'RESOLVED',
              actionTaken: 'Re-peaked fine azimuth vernier screws on Site B dish +3.2 dB gain restored',
              mttrMinutes: 48,
            },
          },
        ];

        for (const item of initialItems) {
          await dexieDb.syncQueue.put(item);
        }
      }
    } catch (err) {
      console.warn('Error seeding initial Dexie sync queue items:', err);
    }
  };

  // Load items from Dexie.js and raw IndexedDB queue
  const loadQueueData = async () => {
    setIsRefreshing(true);
    try {
      await seedDefaultQueueIfEmpty();

      const [dexieItems, currentMetrics] = await Promise.all([
        dexieDb.syncQueue.toArray(),
        getStorageMetrics(),
      ]);
      const idbRawQueue = storage.getQueue();

      // Enrich with diagnostic info
      const enriched: QueuedAuditItem[] = dexieItems.map((item) => ({
        ...item,
        diagnosticInfo: diagnoseError(item.lastError),
      }));

      // In case idbRawQueue has unique items not present in Dexie, append them
      const existingIds = new Set(dexieItems.map((i) => i.id));
      for (const idbItem of idbRawQueue) {
        if (!existingIds.has(idbItem.id)) {
          const mapped: QueuedAuditItem = {
            id: idbItem.id,
            collectionName: (idbItem.action.includes('PHOTO')
              ? 'photos'
              : idbItem.action.includes('WO')
              ? 'work_orders'
              : idbItem.action.includes('INVENTORY')
              ? 'inventory'
              : 'work_orders') as any,
            entityId: idbItem.payload?.id || idbItem.id,
            operation: 'UPDATE',
            payload: idbItem.payload,
            timestamp: idbItem.timestamp,
            status: idbItem.error ? 'FAILED' : 'PENDING',
            retryCount: idbItem.retryCount,
            lastError: idbItem.error,
            diagnosticInfo: diagnoseError(idbItem.error),
          };
          enriched.push(mapped);
        }
      }

      // Sort newest first, with FAILED items given high visibility
      enriched.sort((a, b) => {
        if (a.status === 'FAILED' && b.status !== 'FAILED') return -1;
        if (b.status === 'FAILED' && a.status !== 'FAILED') return 1;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      setQueueItems(enriched);
      setMetrics(currentMetrics);
    } catch (err) {
      console.error('Failed to load queue data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadQueueData();
    const unsub = firestoreSync.subscribe((s) => {
      setSyncState(s);
    });
    return unsub;
  }, []);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return queueItems.filter((item) => {
      // Status filter
      if (statusFilter !== 'ALL' && item.status !== statusFilter) {
        return false;
      }
      // Collection filter
      if (collectionFilter !== 'ALL' && item.collectionName !== collectionFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = item.id.toLowerCase().includes(q);
        const matchEntity = item.entityId.toLowerCase().includes(q);
        const matchCol = item.collectionName.toLowerCase().includes(q);
        const matchErr = (item.lastError || '').toLowerCase().includes(q);
        const matchDiag = (item.diagnosticInfo?.rootCause || '').toLowerCase().includes(q);
        return matchId || matchEntity || matchCol || matchErr || matchDiag;
      }
      return true;
    });
  }, [queueItems, statusFilter, collectionFilter, searchQuery]);

  // Status Counts
  const counts = useMemo(() => {
    const failed = queueItems.filter((i) => i.status === 'FAILED').length;
    const pending = queueItems.filter((i) => i.status === 'PENDING').length;
    const syncing = queueItems.filter((i) => i.status === 'SYNCING').length;
    const synced = queueItems.filter((i) => i.status === 'SYNCED').length;
    return { all: queueItems.length, failed, pending, syncing, synced };
  }, [queueItems]);

  // Actions
  const handleRetryItem = async (item: QueuedAuditItem) => {
    setIsRetryingId(item.id);
    try {
      // If offline, simulate failed or inform user
      if (!firestoreSync.isOnline()) {
        await dexieDb.syncQueue.update(item.id, {
          status: 'FAILED',
          retryCount: item.retryCount + 1,
          lastError: `Network Offline: Cannot reach Cloud Firestore while disconnected (Attempt #${item.retryCount + 1})`,
        });
        await loadQueueData();
        return;
      }

      // Mark syncing
      await dexieDb.syncQueue.update(item.id, { status: 'SYNCING' });
      await loadQueueData();

      // Trigger sync
      const res = await firestoreSync.syncNow();
      if (res.success) {
        // Updated
      }
      await loadQueueData();
    } catch (err: any) {
      console.warn('Retry error:', err);
    } finally {
      setIsRetryingId(null);
    }
  };

  const handleRetryAll = async () => {
    setIsRefreshing(true);
    try {
      await firestoreSync.syncNow();
      await loadQueueData();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (confirm('Discard this queued transaction from IndexedDB? It will not be synced to the cloud.')) {
      await dexieDb.syncQueue.delete(id);
      await loadQueueData();
    }
  };

  const handleClearSynced = async () => {
    const syncedIds = queueItems.filter((i) => i.status === 'SYNCED').map((i) => i.id);
    for (const id of syncedIds) {
      await dexieDb.syncQueue.delete(id);
    }
    await loadQueueData();
  };

  const handleCopyJson = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleExportDiagnostics = () => {
    const dump = {
      exportedAt: new Date().toISOString(),
      app: 'FieldOps MW — Telecom Microwave Operations',
      indexedDb: {
        dexieDbName: 'fieldops_mw_dexie_db',
        idbDbName: 'fieldops_mw_offline_db',
        metrics,
      },
      connection: {
        isOnline: firestoreSync.isOnline(),
        lastSync: syncState.lastSyncTimestamp,
        syncMessage: syncState.currentMessage,
      },
      totalQueued: queueItems.length,
      failedCount: counts.failed,
      pendingCount: counts.pending,
      items: queueItems.map((item) => ({
        id: item.id,
        collectionName: item.collectionName,
        entityId: item.entityId,
        operation: item.operation,
        status: item.status,
        retryCount: item.retryCount,
        timestamp: item.timestamp,
        error: item.lastError,
        diagnosis: item.diagnosticInfo,
        payloadSummary: {
          keys: Object.keys(item.payload || {}),
          id: item.payload?.id,
          siteId: item.payload?.siteId,
        },
      })),
    };

    const jsonStr = JSON.stringify(dump, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setExportNotice('Diagnostic dump copied to clipboard! Ready to paste into NOC incident ticket.');
    setTimeout(() => setExportNotice(null), 4000);
  };

  const handleSimulateCustomItem = async (type: 'TIMEOUT' | 'AUTH' | 'LARGE' | 'VALIDATION' | 'PENDING') => {
    const now = Date.now();
    let newItem: DexieSyncQueueItem;

    if (type === 'TIMEOUT') {
      newItem = {
        id: `sim_err_timeout_${now}`,
        collectionName: 'photos',
        entityId: `photo-pan-${now.toString().slice(-4)}`,
        operation: 'CREATE',
        timestamp: new Date().toISOString(),
        status: 'FAILED',
        retryCount: 1,
        lastError:
          'Network Timeout: ETIMEDOUT during 5.1MB 360-degree panorama upload to Cloud Storage (cell tower RSRP: -118 dBm)',
        payload: {
          id: `photo-pan-${now.toString().slice(-4)}`,
          sectionCode: 'PANORAMA_360',
          siteId: 'NS-TER25-A035',
          caption: 'Simulated 360 degree panoramic azimuth scan',
          fileSizeBytes: 5340120,
        },
      };
    } else if (type === 'AUTH') {
      newItem = {
        id: `sim_err_auth_${now}`,
        collectionName: 'tssr_approvals',
        entityId: 'active_sheet',
        operation: 'UPDATE',
        timestamp: new Date().toISOString(),
        status: 'FAILED',
        retryCount: 2,
        lastError:
          'PERMISSION_DENIED: Firebase Security Rules evaluation failed. Field Technician lacks TSSR_APPROVE role claim.',
        payload: {
          id: 'active_sheet',
          signer: 'Technician Test',
          action: 'STRUCTURAL_SIGN_OFF',
        },
      };
    } else if (type === 'LARGE') {
      newItem = {
        id: `sim_err_payload_${now}`,
        collectionName: 'photos',
        entityId: `photo-blob-${now.toString().slice(-4)}`,
        operation: 'CREATE',
        timestamp: new Date().toISOString(),
        status: 'FAILED',
        retryCount: 1,
        lastError:
          'PayloadTooLarge: Request entity size 12.8MB exceeds Firestore 1MB single document transaction boundary.',
        payload: {
          id: `photo-blob-${now.toString().slice(-4)}`,
          sectionCode: 'RAW_UNCOMPRESSED',
          siteId: 'NS-TER25-A062',
        },
      };
    } else if (type === 'VALIDATION') {
      newItem = {
        id: `sim_err_valid_${now}`,
        collectionName: 'work_orders',
        entityId: 'wo-crane-site-b',
        operation: 'UPDATE',
        timestamp: new Date().toISOString(),
        status: 'FAILED',
        retryCount: 1,
        lastError:
          'ValidationError: Missing mandatory field "gpsLat" in Microwave Dish Azimuth Alignment checklist.',
        payload: {
          id: 'wo-crane-site-b',
          currentStepIndex: 5,
        },
      };
    } else {
      // PENDING
      newItem = {
        id: `sim_pend_${now}`,
        collectionName: 'inventory',
        entityId: `inv-sim-${now.toString().slice(-4)}`,
        operation: 'UPDATE',
        timestamp: new Date().toISOString(),
        status: 'PENDING',
        retryCount: 0,
        payload: {
          id: `inv-sim-${now.toString().slice(-4)}`,
          equipmentType: 'ODU',
          serialNumber: `SN-TEST-${now.toString().slice(-4)}`,
          status: 'DISMANTLED_PENDING_RETURN',
        },
      };
    }

    await dexieDb.syncQueue.put(newItem);
    setShowSimulateModal(false);
    await loadQueueData();
  };

  const getStatusBadge = (status: QueuedAuditItem['status'], retryCount: number) => {
    switch (status) {
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-950/80 text-rose-300 border border-rose-700/80">
            <XCircle className="w-3 h-3 text-rose-400" />
            FAILED ({retryCount} {retryCount === 1 ? 'try' : 'retries'})
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-700/80">
            <Clock className="w-3 h-3 text-amber-400" />
            QUEUED
          </span>
        );
      case 'SYNCING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-700/80">
            <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />
            SYNCING...
          </span>
        );
      case 'SYNCED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-700/80">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            SYNCED
          </span>
        );
      default:
        return null;
    }
  };

  const getCollectionBadge = (name: string) => {
    const colors: Record<string, string> = {
      photos: 'bg-purple-950/80 text-purple-300 border-purple-800',
      work_orders: 'bg-cyan-950/80 text-cyan-300 border-cyan-800',
      inventory: 'bg-amber-950/80 text-amber-300 border-amber-800',
      tickets: 'bg-rose-950/80 text-rose-300 border-rose-800',
      tssr_approvals: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
      audit_logs: 'bg-slate-800 text-slate-300 border-slate-700',
    };
    const c = colors[name] || 'bg-slate-800 text-slate-300 border-slate-700';
    return (
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${c}`}>
        {name.replace('_', ' ')}
      </span>
    );
  };

  const formatRelativeTime = (isoString: string) => {
    const ms = Date.now() - new Date(isoString).getTime();
    if (ms < 0) return 'just now';
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Offline Data Audit & IndexedDB Diagnostic Inspector
            </h2>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
              FIELD TECH DIAGNOSTICS
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time inspection of queued IndexedDB transactions (<span className="text-cyan-300 font-mono">Dexie.js & IDB</span>),
            upload sync statuses, creation timestamps, and root-cause failure diagnostics.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {onNavigateToOverview && (
            <button
              onClick={onNavigateToOverview}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-mono text-xs flex items-center gap-1.5 transition-colors border border-slate-700"
            >
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
              Operations Overview
            </button>
          )}

          <button
            onClick={() => setShowSimulateModal(true)}
            className="px-3 py-1.5 rounded-lg bg-indigo-950 hover:bg-indigo-900 text-indigo-300 font-mono text-xs flex items-center gap-1.5 transition-colors border border-indigo-700 font-bold"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Simulate Queued/Failed Item
          </button>

          <button
            onClick={handleExportDiagnostics}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 font-mono text-xs flex items-center gap-1.5 transition-colors border border-slate-700"
            title="Export full diagnostic report to clipboard for NOC dispatch"
          >
            <Download className="w-3.5 h-3.5" />
            Export NOC Log
          </button>

          <button
            onClick={handleRetryAll}
            disabled={isRefreshing}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Sync Now / Retry All
          </button>
        </div>
      </div>

      {exportNotice && (
        <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs font-mono flex items-center justify-between">
          <span>✓ {exportNotice}</span>
          <button onClick={() => setExportNotice(null)} className="text-emerald-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* KPI & Health Overview Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Failed / Action Needed */}
        <div
          onClick={() => setStatusFilter(counts.failed > 0 ? 'FAILED' : 'ALL')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            counts.failed > 0
              ? 'bg-rose-950/40 border-rose-800 hover:border-rose-600'
              : 'bg-slate-900 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">
              Failed Uploads
            </span>
            <AlertTriangle className={`w-4 h-4 ${counts.failed > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-600'}`} />
          </div>
          <p className={`text-2xl font-bold font-mono mt-1 ${counts.failed > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
            {counts.failed}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {counts.failed > 0 ? 'Requires field diagnostic attention' : 'Zero failed uploads'}
          </p>
        </div>

        {/* Queued Pending */}
        <div
          onClick={() => setStatusFilter('PENDING')}
          className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">
              Pending in Queue
            </span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-amber-400 mt-1">{counts.pending}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Awaiting network trigger</p>
        </div>

        {/* Local Storage Quota */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">
              IndexedDB Storage
            </span>
            <HardDrive className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-cyan-400 mt-1">
            {metrics ? `${metrics.usageMb} MB` : '...'}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5 truncate">
            {metrics ? `${metrics.photoCount} photos · ${metrics.percentageUsed}% quota` : 'Calculating quota...'}
          </p>
        </div>

        {/* Cloud Connection State */}
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">
              Cloud Uplink
            </span>
            {firestoreSync.isOnline() ? (
              <Wifi className="w-4 h-4 text-emerald-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-amber-400 animate-pulse" />
            )}
          </div>
          <div>
            <p className={`text-sm font-bold font-mono uppercase ${firestoreSync.isOnline() ? 'text-emerald-400' : 'text-amber-400'}`}>
              {firestoreSync.isOnline() ? 'ONLINE (4G/LTE)' : 'OFF-GRID MODE'}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
              {syncState.lastSyncTimestamp
                ? `Last sync: ${new Date(syncState.lastSyncTimestamp).toLocaleTimeString()}`
                : 'No sync completed yet'}
            </p>
          </div>
        </div>
      </div>

      {/* Filter, Search & Quick Action Toolbar */}
      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Status Filter Tabs */}
        <div className="flex items-center flex-wrap gap-1.5 text-xs font-mono">
          {[
            { id: 'ALL', label: `All (${counts.all})` },
            { id: 'FAILED', label: `Failed (${counts.failed})`, alert: counts.failed > 0 },
            { id: 'PENDING', label: `Queued (${counts.pending})` },
            { id: 'SYNCED', label: `Synced (${counts.synced})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                statusFilter === tab.id
                  ? tab.alert
                    ? 'bg-rose-900 text-white border border-rose-600'
                    : 'bg-cyan-600 text-white'
                  : tab.alert
                  ? 'bg-rose-950/60 text-rose-300 border border-rose-800 hover:bg-rose-900'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Collection & Search Filter */}
        <div className="flex items-center gap-2 flex-1 max-w-lg justify-end">
          <select
            value={collectionFilter}
            onChange={(e) => setCollectionFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs font-mono focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Stores</option>
            <option value="photos">Photos (TSSR Evidence)</option>
            <option value="work_orders">Work Orders</option>
            <option value="inventory">Inventory Decommission</option>
            <option value="tickets">Troubleshooting Tickets</option>
            <option value="tssr_approvals">TSSR Approvals</option>
          </select>

          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search by ID, error, or entity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-500 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {counts.synced > 0 && (
            <button
              onClick={handleClearSynced}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-mono border border-slate-800 shrink-0"
              title="Clean already synced records from the local audit queue"
            >
              Purge Synced
            </button>
          )}
        </div>
      </div>

      {/* Main List of Queued Items */}
      <div className="space-y-2.5">
        {filteredItems.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <h3 className="font-bold text-white text-sm">No Matching Offline Queue Items</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {queueItems.length === 0
                ? 'All IndexedDB tables are clear. Transactions generated during offline field operations will queue here automatically.'
                : 'No items match the active status or search query. Try switching filters.'}
            </p>
            <div className="pt-2 flex justify-center gap-2">
              <button
                onClick={() => {
                  setStatusFilter('ALL');
                  setCollectionFilter('ALL');
                  setSearchQuery('');
                }}
                className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 hover:text-white text-xs font-mono"
              >
                Reset Filters
              </button>
              <button
                onClick={() => setShowSimulateModal(true)}
                className="px-3 py-1.5 rounded bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-mono font-bold"
              >
                Insert Test Transaction
              </button>
            </div>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isExpanded = expandedItemId === item.id;
            const isPayloadExpanded = expandedPayloadId === item.id;
            const isRetrying = isRetryingId === item.id;
            const diag = item.diagnosticInfo;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-xl bg-slate-900 border transition-all space-y-3 ${
                  item.status === 'FAILED'
                    ? 'border-rose-900/80 bg-rose-950/20'
                    : item.status === 'PENDING'
                    ? 'border-amber-900/50 bg-amber-950/10'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Item Summary Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center flex-wrap gap-2">
                    {getStatusBadge(item.status, item.retryCount)}
                    {getCollectionBadge(item.collectionName)}
                    <span className="font-mono text-xs font-bold text-white">
                      {item.entityId}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                      {item.operation}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                    <span title={new Date(item.timestamp).toLocaleString()}>
                      Created: {formatRelativeTime(item.timestamp)}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      ID: {item.id.slice(0, 16)}...
                    </span>
                  </div>
                </div>

                {/* Technician Diagnostic Box for Failed Uploads */}
                {item.status === 'FAILED' && diag && (
                  <div className="p-3.5 rounded-lg bg-rose-950/60 border border-rose-800 text-xs space-y-2.5">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-bold text-rose-200 uppercase tracking-wide text-[11px] font-mono">
                            Diagnostic Category: {diag.category}
                          </span>
                          <span className="text-[10px] font-mono text-rose-300 bg-rose-900/80 px-2 py-0.5 rounded font-bold">
                            ATTEMPT #{item.retryCount} FAILED
                          </span>
                        </div>
                        <p className="text-xs font-bold text-rose-100 mt-1">
                          {diag.rootCause}
                        </p>
                      </div>
                    </div>

                    {/* Exact Error Log Message */}
                    <div className="p-2.5 rounded bg-black/60 border border-rose-900/80 font-mono text-[11px] text-rose-300 break-all space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-rose-400">
                        <span className="flex items-center gap-1 font-bold uppercase">
                          <Terminal className="w-3 h-3" />
                          Firestore Upload Error Trace:
                        </span>
                        <button
                          onClick={() => handleCopyJson(item.lastError || '', item.id + '_err')}
                          className="hover:text-white flex items-center gap-1"
                        >
                          {copiedId === item.id + '_err' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Log</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="font-mono text-rose-200 pt-0.5">{item.lastError}</p>
                    </div>

                    {/* Field Technician Remediation Action */}
                    <div className="p-2.5 rounded bg-slate-950/80 border border-slate-800 text-[11px] space-y-1">
                      <div className="flex items-center gap-1.5 text-cyan-400 font-bold uppercase text-[10px] font-mono">
                        <HelpCircle className="w-3.5 h-3.5" />
                        Technician Recommended Field Action:
                      </div>
                      <p className="text-slate-200 leading-relaxed">{diag.fieldAction}</p>
                      {diag.telemetryHint && (
                        <p className="text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-800/80">
                          ℹ {diag.telemetryHint}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Non-failed pending message or info */}
                {item.status === 'PENDING' && (
                  <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-900/60 text-xs flex items-center justify-between gap-2 text-amber-300">
                    <span className="flex items-center gap-1.5 text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      Queued locally in Dexie IndexedDB. Auto-uploads once connection to Firestore is established.
                    </span>
                    <span className="text-[10px] font-mono text-amber-400 font-bold">
                      Pending Trigger
                    </span>
                  </div>
                )}

                {/* Synced confirmation */}
                {item.status === 'SYNCED' && (
                  <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-900/60 text-xs flex items-center justify-between gap-2 text-emerald-300">
                    <span className="flex items-center gap-1.5 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      Successfully verified and written to Firestore collection{' '}
                      <strong className="font-mono">"{item.collectionName}"</strong>.
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 font-bold">VERIFIED</span>
                  </div>
                )}

                {/* Expandable Payload Inspector */}
                {isPayloadExpanded && (
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono space-y-2">
                    <div className="flex items-center justify-between text-slate-400 pb-1 border-b border-slate-800">
                      <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
                        <Code className="w-3.5 h-3.5" />
                        Queued IndexedDB Payload Inspection
                      </span>
                      <button
                        onClick={() =>
                          handleCopyJson(JSON.stringify(item.payload, null, 2), item.id + '_payload')
                        }
                        className="hover:text-white flex items-center gap-1 text-[11px]"
                      >
                        {copiedId === item.id + '_payload' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied Payload</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy JSON</span>
                          </>
                        )}
                      </button>
                    </div>

                    <pre className="max-h-60 overflow-y-auto text-[11px] text-slate-300 p-2 rounded bg-black/60 font-mono">
                      {JSON.stringify(item.payload, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Action Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setExpandedPayloadId(isPayloadExpanded ? null : item.id)
                      }
                      className="text-xs font-mono text-slate-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                    >
                      <Code className="w-3 h-3" />
                      {isPayloadExpanded ? 'Hide Payload JSON' : 'Inspect Payload JSON'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.status !== 'SYNCED' && (
                      <button
                        onClick={() => handleRetryItem(item)}
                        disabled={isRetrying}
                        className="px-3 py-1 rounded bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white font-mono font-bold text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
                        {isRetrying ? 'Syncing...' : 'Retry Upload'}
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="px-2 py-1 rounded bg-slate-950 hover:bg-rose-950 text-slate-500 hover:text-rose-400 text-xs font-mono transition-colors border border-slate-800"
                      title="Discard item from offline queue"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Technician Guide & Architecture Notes */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs text-slate-300">
        <h3 className="font-bold text-slate-200 uppercase font-mono flex items-center gap-1.5 text-xs">
          <Info className="w-4 h-4 text-cyan-400" />
          Offline FieldOps Architecture & Resilient Upload Guide
        </h3>
        <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px] leading-relaxed">
          <li>
            <strong className="text-slate-200">Local-First Persistence:</strong> All microwave work orders, TSSR photos, inventory returns, and troubleshooting measurements are committed immediately to browser IndexedDB (<span className="text-cyan-300 font-mono">Dexie.js</span>) before attempting cloud network transmission.
          </li>
          <li>
            <strong className="text-slate-200">Zero Data Loss:</strong> When cellular backhaul fails at remote mountain hops, items stay queued with retry counters and timestamp audit stamps until reliable connectivity is restored.
          </li>
          <li>
            <strong className="text-slate-200">Exponential Backoff & Diagnostics:</strong> Failed uploads capture the exact Firestore security rule or HTTP socket failure message, displaying specific troubleshooting actions for the field engineering crew.
          </li>
        </ul>
      </div>

      {/* Modal: Simulate Test Item */}
      {showSimulateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-5 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base text-white">Simulate Diagnostic Scenarios</h3>
              </div>
              <button
                onClick={() => setShowSimulateModal(false)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Inject a simulated queued transaction or upload error into IndexedDB to verify the technician diagnostics, error trace parsing, and remediation recommendations:
            </p>

            <div className="space-y-2 pt-1 font-mono text-xs">
              <button
                onClick={() => handleSimulateCustomItem('TIMEOUT')}
                className="w-full p-2.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800 text-left flex items-start gap-2.5 transition-colors text-rose-200"
              >
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">1. Remote Site Cellular Uplink Drop (408)</span>
                  <span className="text-[11px] text-rose-300">
                    Simulates high-resolution photo blob transmission timeout in remote mountain terrain.
                  </span>
                </div>
              </button>

              <button
                onClick={() => handleSimulateCustomItem('AUTH')}
                className="w-full p-2.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800 text-left flex items-start gap-2.5 transition-colors text-rose-200"
              >
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">2. Security Rules / Token Expiry (403)</span>
                  <span className="text-[11px] text-rose-300">
                    Simulates expired credentials during off-grid TSSR routing sign-off.
                  </span>
                </div>
              </button>

              <button
                onClick={() => handleSimulateCustomItem('LARGE')}
                className="w-full p-2.5 rounded-lg bg-amber-950/60 hover:bg-amber-900/60 border border-amber-800 text-left flex items-start gap-2.5 transition-colors text-amber-200"
              >
                <HardDrive className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">3. Payload Size Exceeded (413)</span>
                  <span className="text-[11px] text-amber-300">
                    Simulates uncompressed panoramic blob exceeding single transaction limits.
                  </span>
                </div>
              </button>

              <button
                onClick={() => handleSimulateCustomItem('PENDING')}
                className="w-full p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left flex items-start gap-2.5 transition-colors text-cyan-300"
              >
                <Clock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">4. Normal Pending Mutation</span>
                  <span className="text-[11px] text-slate-400">
                    Simulates pending equipment return inventory record awaiting upload.
                  </span>
                </div>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowSimulateModal(false)}
                className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
