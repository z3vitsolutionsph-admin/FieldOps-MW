import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Radio,
  MapPin,
  TrendingUp,
  Package,
  Shield,
  Activity,
  Layers,
  Search,
  Map as MapIcon,
  Database,
  HardDrive,
  WifiOff,
  Wifi,
  Compass,
  ArrowRight,
  Upload,
  ShieldCheck,
  Briefcase,
  UserCheck,
  FileText,
  Sparkles,
} from 'lucide-react';
import {
  WorkOrder,
  Site,
  Hop,
  PhotoEvidence,
  InventoryItem,
  TroubleshootingTicket,
  AuditLogItem,
  UserProfile,
  ParsedTssrProjectData,
} from '../../types/fieldops';
import { storage } from '../../services/storageService';
import { dexieDb } from '../../services/dexieDbService';
import { firestoreSync } from '../../services/firestoreSyncService';
import { SEED_SITE_A, SEED_SITE_B, SEED_HOP } from '../../data/seedData';
import { SiteMapLeaflet } from './SiteMapLeaflet';
import { RfFresnelDiagram } from './RfFresnelDiagram';
import { OfflineDataAudit } from './OfflineDataAudit';
import { WeatherForecastWidget } from '../weather/WeatherForecastWidget';

interface DashboardProps {
  workOrders: WorkOrder[];
  siteA?: Site | null;
  siteB?: Site | null;
  hop?: Hop | null;
  photos: PhotoEvidence[];
  inventory: InventoryItem[];
  tickets: TroubleshootingTicket[];
  activeUser?: UserProfile;
  onSelectWorkOrder: (wo: WorkOrder) => void;
  onStartJob: (wo: WorkOrder) => void;
  onNavigateToJobs: () => void;
  onNavigateToTssr?: () => void;
  sunlightMode: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  workOrders,
  siteA,
  siteB,
  hop,
  photos,
  inventory,
  tickets,
  activeUser,
  onSelectWorkOrder,
  onStartJob,
  onNavigateToJobs,
  onNavigateToTssr,
  sunlightMode,
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [dashboardTab, setDashboardTab] = useState<'OVERVIEW' | 'OFFLINE_AUDIT'>('OVERVIEW');
  const [queueStats, setQueueStats] = useState<{ total: number; failed: number; pending: number }>({
    total: 0,
    failed: 0,
    pending: 0,
  });
  const [mapDisplayMode, setMapDisplayMode] = useState<'LEAFLET' | 'FRESNEL' | 'SPLIT'>('LEAFLET');
  const [gisProbeDistanceKm, setGisProbeDistanceKm] = useState<number | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');

  const hasActiveTssr = storage.hasActiveTssr();
  const effectiveSiteA: Site = siteA || {
    ...SEED_SITE_A,
    id: 'AWAITING-SITE-A',
    name: 'Site A (Pending TSSR)',
  };
  const effectiveSiteB: Site = siteB || {
    ...SEED_SITE_B,
    id: 'AWAITING-SITE-B',
    name: 'Site B (Pending TSSR)',
  };
  const effectiveHop: Hop = hop || {
    ...SEED_HOP,
    id: 'hop-pending',
    hopName: 'Microwave Link (Pending TSSR)',
  };

  const auditLogs = storage.getAuditLogs();
  const allSites = storage.getSites();
  const allHops = storage.getHops();

  const inProgressCount = workOrders.filter((w) => w.status === 'IN_PROGRESS').length;
  const pendingReviewCount = workOrders.filter((w) => w.status === 'PENDING_REVIEW').length;
  const approvedCount = workOrders.filter((w) => w.status === 'APPROVED').length;
  const ftrRate = 96.4; // First-time-right percentage
  const avgMttr = 65; // Minutes

  const refreshQueueStats = async () => {
    try {
      const items = await dexieDb.syncQueue.toArray();
      const failed = items.filter((i) => i.status === 'FAILED').length;
      const pending = items.filter((i) => i.status === 'PENDING').length;
      setQueueStats({ total: items.length, failed, pending });
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    refreshQueueStats();
    const unsub = firestoreSync.subscribe(() => {
      refreshQueueStats();
    });
    return unsub;
  }, []);

  // Filter sites by PLA ID, name, address, tower provider, or region
  const filteredSites = allSites.filter((site) => {
    // Match Region (all seed hops belong to Region MIN)
    const siteRegion = 'MIN';
    if (selectedRegion !== 'ALL' && siteRegion !== selectedRegion) {
      return false;
    }

    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const matchId = site.id.toLowerCase().includes(query);
    const matchName = site.name.toLowerCase().includes(query);
    const matchAddress = site.address.toLowerCase().includes(query);
    const matchProvider = site.ownerTowerProvider.toLowerCase().includes(query);
    const matchTower = site.tower.type.toLowerCase().includes(query);
    const matchRegion = 'min mindanao surigao'.includes(query);

    return matchId || matchName || matchAddress || matchProvider || matchTower || matchRegion;
  });

  const filteredOrders = workOrders.filter((wo) => {
    if (filterType === 'ALL') return true;
    return wo.type === filterType;
  });

  return (
    <div className="space-y-4">
      {/* Dashboard Top View Tabs (Operations Overview vs Offline Data Audit) */}
      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setDashboardTab('OVERVIEW')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors flex items-center gap-1.5 ${
              dashboardTab === 'OVERVIEW'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Operations Overview
          </button>

          <button
            onClick={() => setDashboardTab('OFFLINE_AUDIT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors flex items-center gap-2 ${
              dashboardTab === 'OFFLINE_AUDIT'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            Offline Data Audit
            {queueStats.failed > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-600 text-white font-mono animate-pulse">
                {queueStats.failed} failed
              </span>
            ) : queueStats.pending > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-slate-950 font-mono font-bold">
                {queueStats.pending} queued
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
                {queueStats.total}
              </span>
            )}
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-400 pr-2">
          <span>Dexie.js IndexedDB:</span>
          <span className="text-emerald-400 font-bold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Active
          </span>
        </div>
      </div>

      {dashboardTab === 'OVERVIEW' && (
        <div className="space-y-3">
          {/* TSSR Project Data Source Authority Card */}
          {hasActiveTssr ? (
            <div className="bg-gradient-to-r from-slate-900 via-blue-950/40 to-slate-900 border border-blue-700/60 rounded-2xl p-4 shadow-xl text-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-600/30 border border-blue-500/50 flex items-center justify-center text-blue-400 shrink-0 shadow-inner mt-0.5">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-bold tracking-tight text-white uppercase">
                      Active TSSR Project Data Source
                    </h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      PM TSSR BINDING ACTIVE
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Microwave Hop GIS ({effectiveHop.hopName}), Regional Sites Directory ({effectiveSiteA.id} ↔ {effectiveSiteB.id}), and Jobs & Work Order Schedule ({workOrders.length} active orders) are dynamically bound to the Project Manager's uploaded TSSR.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                {onNavigateToTssr && (
                  <button
                    onClick={onNavigateToTssr}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold shadow flex items-center gap-1.5 transition-all"
                    title="Upload or change TSSR engineering dossier"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload / Re-ingest TSSR</span>
                  </button>
                )}
                <button
                  onClick={onNavigateToJobs}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold shadow-lg shadow-cyan-950 flex items-center gap-2 transition-all transform active:scale-95"
                >
                  <span>Proceed to Jobs</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-blue-950/40 border-2 border-amber-500/60 rounded-2xl p-4 sm:p-5 shadow-2xl text-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0 shadow-inner mt-0.5">
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-bold tracking-tight text-white uppercase">
                      System Clean Slate · Ready for New TSSR Ingestion
                    </h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/50 font-bold">
                      PREVIOUS TSSR DATA REMOVED
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                    All previous TSSR data has been removed to test AI capabilities. Upload a new Technical Site Survey Report (.pdf, .txt, .docx, .json) or load a sample preset in the TSSR module to watch Gemini AI extract coordinates, tower heights, ACL centerline, power specs, and synthesize deployment work orders.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                {onNavigateToTssr && (
                  <button
                    onClick={onNavigateToTssr}
                    className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold shadow-lg shadow-blue-950 flex items-center justify-center gap-2 transition-all transform active:scale-95"
                    title="Upload or change TSSR engineering dossier"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload TSSR Dossier (PM Role)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Prescribed RBAC User Flow Stepper & Privileges Banner */}
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {activeUser?.role === 'PROJECT_MANAGER' ? (
                  <Briefcase className="w-4 h-4 text-blue-400" />
                ) : (
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                )}
                <span className="text-xs font-mono font-bold text-white uppercase">
                  User Flow: {activeUser?.role === 'PROJECT_MANAGER' ? 'Project Manager' : 'Team Leader'} Role
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                  {activeUser?.name}
                </span>
              </div>

              {/* Stepper Ribbon */}
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none font-mono text-[10px]">
                <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                  Login Page
                </span>
                <span className="text-slate-600 font-bold">→</span>
                <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                  Signup
                </span>
                <span className="text-slate-600 font-bold">→</span>
                {activeUser?.role === 'PROJECT_MANAGER' && (
                  <>
                    <button
                      onClick={onNavigateToTssr}
                      className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-700 font-bold hover:bg-blue-900"
                    >
                      Upload TSSR
                    </button>
                    <span className="text-slate-600 font-bold">→</span>
                  </>
                )}
                <span className="px-2 py-0.5 rounded bg-cyan-600 text-white font-bold shadow">
                  Dashboard (Active)
                </span>
                <span className="text-slate-600 font-bold">→</span>
                <button
                  onClick={onNavigateToJobs}
                  className="px-2 py-0.5 rounded bg-slate-950 text-cyan-300 border border-cyan-800/80 hover:bg-slate-800 font-bold"
                >
                  Jobs
                </button>
                <span className="text-slate-600 font-bold">→</span>
                <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                  Steps
                </span>
                <span className="text-slate-600 font-bold">→</span>
                <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                  Completed
                </span>
              </div>
            </div>

            {/* Privileges checklist badges */}
            <div className="pt-2 border-t border-slate-800 flex items-center gap-2 flex-wrap text-[11px] font-mono">
              <span className="text-slate-400 flex items-center gap-1 font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                Active Privileges:
              </span>
              {activeUser?.role === 'PROJECT_MANAGER' ? (
                <>
                  <span className="px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800">
                    View All Work Orders
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800">
                    Assigned Work Orders (Team Leader)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800">
                    Export Reports
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800">
                    Milestone Tracking
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800">
                    Cost & Schedule Audits
                  </span>
                </>
              ) : (
                <>
                  <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                    QR/Barcode Inventory Scan
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                    Battery Discharge Telemetry
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                    Field Data Logging
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                    Approve Pre-Climb Checklists
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                    Incident & Hazard Logging
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                    Crew Safety Oversight
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                    Photo Capture & Upload
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                    Mandatory Pre-Climb Check
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                    Height & Rigging Execution
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {dashboardTab === 'OFFLINE_AUDIT' ? (
        <OfflineDataAudit
          sunlightMode={sunlightMode}
          onNavigateToOverview={() => setDashboardTab('OVERVIEW')}
        />
      ) : (
        <>
          {/* Localized Weather Forecast & Tower Safety Telemetry Widget */}
          <WeatherForecastWidget
            sunlightMode={sunlightMode}
            siteCoords={{
              lat: effectiveSiteA.lat,
              lon: effectiveSiteA.long,
              name: `Site A: ${effectiveSiteA.id} (${effectiveSiteA.name})`,
            }}
          />

          {/* Top KPI Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                Active Jobs
              </span>
              <p className="text-2xl font-bold font-mono text-cyan-400 mt-1">
                {inProgressCount + pendingReviewCount}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {inProgressCount} In Progress · {pendingReviewCount} Pending Review
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                First-Time-Right (FTR)
              </span>
              <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">{ftrRate}%</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Zero ACL height re-works</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                Average MTTR
              </span>
              <p className="text-2xl font-bold font-mono text-purple-400 mt-1">{avgMttr}m</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Mean Time to Restoration</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                Equipment Reclaimed
              </span>
              <p className="text-2xl font-bold font-mono text-amber-400 mt-1">{inventory.length}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Assets in Return Chain</p>
            </div>

            {/* Offline Data Queue Quick Audit Card */}
            <div
              onClick={() => setDashboardTab('OFFLINE_AUDIT')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                queueStats.failed > 0
                  ? 'bg-rose-950/40 border-rose-800 hover:border-rose-600'
                  : 'bg-slate-900 border-slate-800 hover:border-cyan-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                  Offline Queue Audit
                </span>
                <Database className={`w-3.5 h-3.5 ${queueStats.failed > 0 ? 'text-rose-400 animate-pulse' : 'text-cyan-400'}`} />
              </div>
              <p className={`text-2xl font-bold font-mono mt-1 ${queueStats.failed > 0 ? 'text-rose-400' : 'text-cyan-400'}`}>
                {queueStats.total}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-between">
                <span>{queueStats.failed} failed · {queueStats.pending} queued</span>
                <span className="text-cyan-400 font-bold">Audit ➔</span>
              </p>
            </div>
          </div>

      {/* Interactive Hop Link Map & GIS Visualization */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <MapIcon className="w-4 h-4 text-cyan-400" />
              Microwave Hop GIS Map & Path Geometry
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Hop: {effectiveHop.hopName} ({effectiveHop.pathLengthKm} km · {(effectiveHop.frequencyMHz / 1000).toFixed(1)} GHz)
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Display Mode Toggle */}
            <div className="flex items-center rounded-lg bg-slate-950 border border-slate-800 p-0.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setMapDisplayMode('LEAFLET')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                  mapDisplayMode === 'LEAFLET'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Geographic Map (GIS)
              </button>
              <button
                type="button"
                onClick={() => setMapDisplayMode('FRESNEL')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                  mapDisplayMode === 'FRESNEL'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                RF Fresnel Diagram
              </button>
              <button
                type="button"
                onClick={() => setMapDisplayMode('SPLIT')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                  mapDisplayMode === 'SPLIT'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Synchronized Dual GIS Map & RF Fresnel Terrain Profile"
              >
                Dual GIS + Profile
              </button>
            </div>

            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border hidden sm:inline ${
              hasActiveTssr
                ? 'text-emerald-400 bg-emerald-950 border-emerald-800'
                : 'text-amber-400 bg-amber-950 border-amber-800'
            }`}>
              {hasActiveTssr ? 'LINK ACTIVE' : 'AWAITING TSSR'}
            </span>
          </div>
        </div>

        {/* Render Leaflet GIS Map, High-Precision RF Fresnel Profile, or Synchronized Dual View */}
        {mapDisplayMode === 'LEAFLET' && (
          <SiteMapLeaflet
            siteA={effectiveSiteA}
            siteB={effectiveSiteB}
            hop={effectiveHop}
            allSites={allSites}
            sunlightMode={sunlightMode}
            probeDistanceKm={gisProbeDistanceKm}
          />
        )}

        {mapDisplayMode === 'FRESNEL' && (
          <RfFresnelDiagram
            siteA={effectiveSiteA}
            siteB={effectiveSiteB}
            hop={effectiveHop}
            sunlightMode={sunlightMode}
            onProbeDistanceChange={setGisProbeDistanceKm}
          />
        )}

        {mapDisplayMode === 'SPLIT' && (
          <div className="space-y-3">
            <SiteMapLeaflet
              siteA={effectiveSiteA}
              siteB={effectiveSiteB}
              hop={effectiveHop}
              allSites={allSites}
              sunlightMode={sunlightMode}
              probeDistanceKm={gisProbeDistanceKm}
            />
            <RfFresnelDiagram
              siteA={effectiveSiteA}
              siteB={effectiveSiteB}
              hop={effectiveHop}
              sunlightMode={sunlightMode}
              onProbeDistanceChange={setGisProbeDistanceKm}
            />
          </div>
        )}
      </div>

      {/* Regional Sites Directory Search & Hop Explorer */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan-400" />
              Regional Sites Directory ({filteredSites.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Quickly find microwave sites by PLA ID, name, region, or tower provider
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-mono">Region:</span>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-cyan-400 font-bold"
            >
              <option value="ALL">All Regions (MIN, NCR, SLUZ, VIS)</option>
              <option value="MIN">Region MIN (Mindanao / Surigao)</option>
              <option value="NCR">Region NCR (Metro Manila)</option>
              <option value="SLUZ">Region SLUZ (South Luzon)</option>
              <option value="VIS">Region VIS (Visayas)</option>
            </select>
          </div>
        </div>

        {/* Search Bar Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by PLA ID (e.g. NS-TER25-A035), site name, or municipality..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-20 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 font-mono"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filtered Sites Results */}
        {filteredSites.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800 text-center space-y-2">
            <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto" />
            <p className="text-xs text-slate-300">
              No sites found matching <strong className="text-white">"{searchQuery}"</strong> in {selectedRegion === 'ALL' ? 'any region' : `Region ${selectedRegion}`}.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedRegion('ALL');
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-cyan-400 hover:bg-slate-700 font-mono font-bold"
            >
              Reset Search Filter
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {filteredSites.map((site) => {
              const matchedWo = workOrders.find((w) => w.siteId === site.id);
              return (
                <div
                  key={site.id}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-600/70 transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-cyan-400">
                        {site.id}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold font-mono">
                        Site {site.role}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono font-bold">
                        Region MIN
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 font-bold">
                      {site.ownerTowerProvider}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-white truncate">{site.name}</h4>
                    <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{site.address}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-300 pt-1 border-t border-slate-800/80">
                    <div>
                      <span className="text-slate-500 block">Tower / Elevation:</span>
                      <span className="font-bold text-slate-200">
                        {site.tower.heightM ? `${site.tower.heightM}m SST` : 'Greenfield'} · {site.elevationM}m AMSL
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Coordinates:</span>
                      <span className="text-slate-200">
                        {site.lat.toFixed(4)}°N, {site.long.toFixed(4)}°E
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-800/60">
                    <span className="text-[10px] text-slate-400 font-mono">
                      Azimuth: <strong>{site.role === 'B' ? '241.02°' : '61.02°'}</strong>
                    </span>
                    {matchedWo && (
                      <button
                        onClick={() => onSelectWorkOrder(matchedWo)}
                        className="px-2.5 py-1 rounded bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-[11px] flex items-center gap-1 transition-colors"
                      >
                        Open Work Order ➔
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Work Orders List with Filter */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="font-bold text-sm text-white">Work Orders Schedule</h3>

          <div className="flex items-center gap-1 text-xs">
            {['ALL', 'INSTALLATION', 'DISMANTLING', 'TROUBLESHOOTING'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                  filterType === type
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {filteredOrders.map((wo) => {
            const isSiteB = wo.siteId === effectiveSiteB.id;
            return (
              <div
                key={wo.id}
                onClick={() => onSelectWorkOrder(wo)}
                className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-600 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-cyan-400">
                      {wo.workOrderNumber}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                      {wo.type}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                        wo.status === 'IN_PROGRESS'
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                          : wo.status === 'PENDING_REVIEW'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      {wo.status.replace('_', ' ')}
                    </span>
                    {wo.shiftHandovers && wo.shiftHandovers.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-slate-900 text-cyan-300 border border-slate-700 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 text-cyan-400" />
                        <span>{wo.shiftHandovers.length} Shift Log{wo.shiftHandovers.length > 1 ? 's' : ''}</span>
                        {wo.shiftHandovers[0]?.remainingTasks?.length > 0 && (
                          <span className="text-amber-400">({wo.shiftHandovers[0].remainingTasks.length} tasks)</span>
                        )}
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-bold text-white mt-1">
                    Site {wo.siteRole}: {wo.siteId} ({isSiteB ? effectiveSiteB.name : effectiveSiteA.name})
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Scheduled: {wo.scheduledDate} · Version: {wo.tssrSnapshotVersion}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {wo.status !== 'IN_PROGRESS' && wo.status !== 'APPROVED' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartJob(wo);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition-colors"
                      title="Run Pre-Climb Safety Check & Start Job"
                    >
                      <span>Start Job</span>
                    </button>
                  )}
                  <span className="text-xs text-cyan-400 group-hover:translate-x-1 transition-transform font-bold">
                    {wo.status === 'IN_PROGRESS' ? 'Resume Job ➔' : 'Open ➔'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Operational Audit Trail */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
        <h3 className="font-bold text-xs text-slate-300 uppercase font-mono">
          Security & Compliance Audit Trail (Org: TowerLink PH)
        </h3>
        {auditLogs.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">No recent audit log entries.</p>
        ) : (
          <div className="max-h-36 overflow-y-auto space-y-1 text-[11px] font-mono">
            {auditLogs.slice(0, 5).map((log) => (
              <div
                key={log.id}
                className="p-1.5 rounded bg-slate-950 text-slate-400 flex items-center justify-between"
              >
                <span>
                  <strong className="text-cyan-400">{log.userName}</strong>: {log.details}
                </span>
                <span className="text-[10px] text-slate-600">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
};
