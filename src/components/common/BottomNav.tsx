import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Wrench,
  Camera,
  FileCheck,
  Bot,
  BarChart3,
  RefreshCw,
  X,
  AlertTriangle,
  CheckCircle2,
  Database,
  Cloud,
  CloudOff,
  Download,
  HardDrive,
  Layers,
} from 'lucide-react';
import { OfflineQueueItem } from '../../types/fieldops';
import { storage } from '../../services/storageService';
import { getStorageMetrics, dexieDb } from '../../services/dexieDbService';
import { firestoreSync, SyncStatusState } from '../../services/firestoreSyncService';

export type ActiveTab = 'JOBS' | 'TOOLS' | 'PHOTOS' | 'TSSR' | 'AI' | 'DASHBOARD';

interface BottomNavProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  sunlightMode: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  sunlightMode,
}) => {
  // `short` keeps six tabs legible on a 360px phone; the full label shows from sm up.
  const tabs = [
    { id: 'JOBS', label: 'Jobs', short: 'Jobs', icon: Briefcase },
    { id: 'TOOLS', label: 'MW Tools', short: 'Tools', icon: Wrench },
    { id: 'PHOTOS', label: 'Photos', short: 'Photos', icon: Camera },
    { id: 'TSSR', label: 'TSSR / ACL', short: 'TSSR', icon: FileCheck },
    { id: 'AI', label: 'Ask AI', short: 'Ask AI', icon: Bot },
    { id: 'DASHBOARD', label: 'Dashboard', short: 'Overview', icon: BarChart3 },
  ] as const;

  return (
    <nav
      aria-label="Primary"
      className={`fixed bottom-0 left-0 right-0 z-40 border-t pb-safe transition-colors lg:hidden ${
        sunlightMode
          ? 'bg-amber-100 border-amber-400 text-black'
          : 'bg-slate-900/95 backdrop-blur-md border-slate-800 text-slate-300'
      }`}
    >
      <div className="max-w-2xl mx-auto grid grid-cols-6 gap-0.5 px-1 sm:px-2 pt-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative min-w-0 min-h-14 px-0.5 flex flex-col items-center justify-center gap-1 rounded-lg transition-colors active:bg-slate-800 ${
                isActive
                  ? sunlightMode
                    ? 'text-black font-extrabold'
                    : 'text-cyan-300 font-semibold bg-cyan-950/50'
                  : sunlightMode
                  ? 'text-neutral-700 hover:text-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 inset-x-3 h-0.5 rounded-full bg-cyan-400" aria-hidden />
              )}
              <Icon className="w-6 h-6 shrink-0" aria-hidden />
              <span className="text-[12px] tracking-tight leading-none max-w-full truncate">
                <span className="sm:hidden">{tab.short}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOnline: boolean;
  queue: OfflineQueueItem[];
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  isOnline,
  queue,
}) => {
  const [metrics, setMetrics] = useState<{
    usageMb: number;
    quotaMb: number;
    percentageUsed: number;
    photoCount: number;
    pendingSyncCount: number;
  } | null>(null);

  const [syncState, setSyncState] = useState<SyncStatusState>(firestoreSync.getState());
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [pullMessage, setPullMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      getStorageMetrics().then(setMetrics);
      const unsubscribe = firestoreSync.subscribe((state) => {
        setSyncState(state);
      });
      return unsubscribe;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSyncNow = async () => {
    await storage.processQueue();
    const updated = await getStorageMetrics();
    setMetrics(updated);
  };

  const handlePullFromFirestore = async () => {
    setIsPulling(true);
    setPullMessage('Pulling cloud updates from Firestore...');
    const res = await firestoreSync.pullFromFirestore();
    setIsPulling(false);
    setPullMessage(res.message);
    const updated = await getStorageMetrics();
    setMetrics(updated);
    setTimeout(() => setPullMessage(null), 4000);
  };

  const handleClearQueue = async () => {
    if (confirm('Are you sure you want to discard unsynced offline records from Dexie.js queue?')) {
      await storage.clearQueue();
      const updated = await getStorageMetrics();
      setMetrics(updated);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-5 shadow-2xl text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="font-bold text-base">Dexie.js Offline Storage & Firestore Sync</h3>
              <p className="text-xs text-slate-400">IndexedDB Local-First Architecture</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3 overflow-y-auto pr-1 flex-1">
          {/* Connection Status Card */}
          <div
            className={`p-3 rounded-lg border flex items-center justify-between ${
              isOnline
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                : 'bg-amber-950/40 border-amber-800 text-amber-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {isOnline ? (
                <Cloud className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <CloudOff className="w-5 h-5 text-amber-400 shrink-0" />
              )}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide">
                  {isOnline ? 'Online — Connected to Firestore' : 'Offline — Remote Tower Mode'}
                </p>
                <p className="text-xs text-slate-300">
                  {isOnline
                    ? 'Mutations auto-sync to Cloud Firestore with Dexie.js offline fallback.'
                    : 'All work orders, photos, and form entries are saved locally in Dexie.js.'}
                </p>
              </div>
            </div>
            <span
              className={`text-xs font-mono px-2 py-0.5 rounded font-bold uppercase ${
                isOnline ? 'bg-emerald-900/60 text-emerald-200' : 'bg-amber-900/60 text-amber-200'
              }`}
            >
              {isOnline ? 'LIVE SYNC' : 'OFFLINE'}
            </span>
          </div>

          {/* Dexie.js Storage Metrics Panel */}
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between font-mono">
              <span className="text-slate-400 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                Local Database:
              </span>
              <span className="text-cyan-400 font-bold">Dexie.js (fieldops_mw_dexie_db)</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-900 font-mono text-xs">
              <div>
                <span className="text-slate-400 block">Disk Space Used:</span>
                <span className="text-slate-200 font-bold">
                  {metrics ? `${metrics.usageMb} MB` : 'Calculating...'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Photos in Dexie:</span>
                <span className="text-slate-200 font-bold">
                  {metrics ? `${metrics.photoCount} evidence items` : '...'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-900">
              <span className="text-slate-400">Firestore Cloud Sync Engine:</span>
              <span className="text-emerald-400 font-mono">
                {syncState.lastSyncTimestamp
                  ? `Last sync: ${new Date(syncState.lastSyncTimestamp).toLocaleTimeString()}`
                  : 'Pending first sync'}
              </span>
            </div>

            {/* Current Sync Status Message */}
            <div className="flex items-center gap-2 p-2 rounded bg-slate-900 text-xs text-slate-300">
              {syncState.isSyncing ? (
                <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              )}
              <span className="truncate">{syncState.currentMessage}</span>
            </div>

            {pullMessage && (
              <div className="p-2 rounded bg-cyan-950/40 border border-cyan-800 text-xs text-cyan-300">
                {pullMessage}
              </div>
            )}
          </div>

          {/* VISUAL PROGRESS INDICATOR: Batched Photo Uploads & Data Synchronizations */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-slate-200 flex items-center gap-1.5 uppercase tracking-wide">
                <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${syncState.isSyncing ? 'animate-spin' : ''}`} />
                Batch Synchronization Progress
              </span>
              <span
                className={`font-bold px-2 py-0.5 rounded text-xs ${
                  syncState.isSyncing
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-700 animate-pulse'
                    : syncState.totalProgressPercent === 100
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                {syncState.isSyncing
                  ? `${syncState.totalProgressPercent}% SYNCING`
                  : syncState.totalProgressPercent === 100
                  ? '100% IN SYNC'
                  : 'READY TO SYNC'}
              </span>
            </div>

            {/* Total Overall Progress Bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span>Total Batch Progress:</span>
                <span className="text-slate-200 font-bold">
                  {syncState.isSyncing
                    ? `${syncState.syncedItemsCount} / ${syncState.totalItemsToSync} items (${syncState.totalProgressPercent}%)`
                    : queue.length > 0
                    ? `${queue.length} items queued for cloud write`
                    : 'All offline items reconciled'}
                </span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 transition-all duration-300 rounded-full shadow-lg shadow-cyan-500/50"
                  style={{
                    width: syncState.isSyncing
                      ? `${Math.max(4, syncState.totalProgressPercent)}%`
                      : syncState.totalProgressPercent === 100
                      ? '100%'
                      : queue.length > 0
                      ? '0%'
                      : '100%',
                  }}
                />
              </div>
            </div>

            {/* Dual Sub-Progress Bars: Photo Evidence vs Data Synchronizations */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {/* Photo Uploads Progress */}
              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-cyan-300 font-semibold">
                    <Camera className="w-3.5 h-3.5 text-cyan-400" />
                    Photo Uploads
                  </span>
                  <span className="font-bold text-cyan-400">
                    {syncState.isSyncing
                      ? `${syncState.photoSyncedCount}/${syncState.photoTotalCount}`
                      : `${queue.filter((q) => q.action === 'UPLOAD_PHOTO' || q.action.includes('PHOTO')).length} queued`}
                  </span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-300 rounded-full"
                    style={{
                      width: syncState.isSyncing
                        ? `${syncState.photoProgressPercent}%`
                        : syncState.totalProgressPercent === 100
                        ? '100%'
                        : '0%',
                    }}
                  />
                </div>
                <div className="text-xs text-slate-400 flex items-center justify-between">
                  <span>Base64/Binary Stream</span>
                  <span>{syncState.photoProgressPercent}%</span>
                </div>
              </div>

              {/* Data Synchronizations Progress */}
              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-purple-300 font-semibold">
                    <Layers className="w-3.5 h-3.5 text-purple-400" />
                    Data Mutations
                  </span>
                  <span className="font-bold text-purple-400">
                    {syncState.isSyncing
                      ? `${syncState.dataSyncedCount}/${syncState.dataTotalCount}`
                      : `${queue.filter((q) => q.action !== 'UPLOAD_PHOTO' && !q.action.includes('PHOTO')).length} queued`}
                  </span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-purple-400 transition-all duration-300 rounded-full"
                    style={{
                      width: syncState.isSyncing
                        ? `${syncState.dataProgressPercent}%`
                        : syncState.totalProgressPercent === 100
                        ? '100%'
                        : '0%',
                    }}
                  />
                </div>
                <div className="text-xs text-slate-400 flex items-center justify-between">
                  <span>Work Orders & Tickets</span>
                  <span>{syncState.dataProgressPercent}%</span>
                </div>
              </div>
            </div>

            {/* Active Transmission Stream Ticker */}
            {syncState.isSyncing && syncState.activeItemName && (
              <div className="p-2 rounded-lg bg-cyan-950/40 border border-cyan-800/80 text-xs font-mono text-cyan-200 flex items-center gap-2 animate-fadeIn">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
                <span className="truncate">
                  STREAMING [{syncState.activeItemCategory}]: {syncState.activeItemName}
                </span>
              </div>
            )}

            {/* Test Simulation Button */}
            {!syncState.isSyncing && (
              <button
                onClick={() => firestoreSync.simulateBatchProgressDemo(4, 6)}
                className="w-full py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-700/80 text-xs font-mono text-cyan-300 flex items-center justify-center gap-1.5 transition-colors"
                title="Test and verify visual batch progress indicator with sample photos and data records"
              >
                <span>Preview Visual Batch Progress Animation</span>
              </button>
            )}
          </div>

          {/* Queued Offline Transactions */}
          <div>
            <div className="flex items-center justify-between mb-1.5 text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                Pending Dexie.js Queue
              </span>
              <span className="font-mono text-cyan-400 font-bold">{queue.length} items</span>
            </div>

            {queue.length === 0 ? (
              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
                All work orders, photos, and form entries are in sync with Firestore.
              </div>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1.5 p-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
                {queue.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 rounded bg-slate-900 border border-slate-800 text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-mono text-xs font-bold text-amber-300">
                        {item.action}
                      </span>
                      <p className="text-xs text-slate-400">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
                      Pending Cloud Write
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2 shrink-0">
          {queue.length > 0 && (
            <button
              onClick={handleClearQueue}
              className="px-3 py-1.5 rounded text-xs text-rose-400 hover:bg-rose-950/50 transition-colors"
            >
              Clear Queue
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handlePullFromFirestore}
              disabled={!isOnline || isPulling}
              className="px-3 py-1.5 rounded text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 flex items-center gap-1.5"
              title="Pull latest remote changes from Cloud Firestore"
            >
              <Download className={`w-3.5 h-3.5 ${isPulling ? 'animate-bounce' : ''}`} />
              Pull Cloud
            </button>

            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              Close
            </button>

            <button
              onClick={handleSyncNow}
              disabled={!isOnline || syncState.isSyncing}
              className="px-4 py-1.5 rounded text-xs font-bold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center gap-1.5 shadow"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncState.isSyncing ? 'animate-spin' : ''}`} />
              {syncState.isSyncing ? 'Syncing...' : 'Sync Firestore'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
