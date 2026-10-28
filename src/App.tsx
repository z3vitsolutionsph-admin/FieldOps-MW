import React, { lazy, Suspense, useState, useEffect } from 'react';
import { Header } from './components/common/Header';
import { BottomNav, ActiveTab, SyncModal } from './components/common/BottomNav';
import { RoleGate } from './components/auth/RoleGate';
import { EnterpriseSidebar } from './components/common/EnterpriseSidebar';
import { hasPermission } from './services/rbacService';
import { storage } from './services/storageService';
import {
  WorkOrder,
  UserProfile,
  Site,
  Hop,
  PhotoEvidence,
  InventoryItem,
  TroubleshootingTicket,
  TssrApprovalSheet,
  OfflineQueueItem,
} from './types/fieldops';
import {
  SEED_SITE_A,
  SEED_SITE_B,
  SEED_HOP,
  SEED_WORK_ORDERS,
  SEED_INVENTORY,
  SEED_TICKETS,
  SEED_TSSR_APPROVALS,
  SEED_USERS,
} from './data/seedData';
import { WifiOff, AlertTriangle, ArrowRight, ShieldCheck, UserCheck, Lock, FileText, Clock, Upload } from 'lucide-react';

const InstallationWizard = lazy(() => import('./components/installation/InstallationWizard').then((m) => ({ default: m.InstallationWizard })));
const DismantlingModule = lazy(() => import('./components/dismantling/DismantlingModule').then((m) => ({ default: m.DismantlingModule })));
const TroubleshootingModule = lazy(() => import('./components/troubleshooting/TroubleshootingModule').then((m) => ({ default: m.TroubleshootingModule })));
const ToolsPage = lazy(() => import('./components/tools/ToolsPage').then((m) => ({ default: m.ToolsPage })));
const PhotoEngine = lazy(() => import('./components/photos/PhotoEngine').then((m) => ({ default: m.PhotoEngine })));
const TssrModule = lazy(() => import('./components/tssr/TssrModule').then((m) => ({ default: m.TssrModule })));
const AIAssistant = lazy(() => import('./components/ai/AIAssistant').then((m) => ({ default: m.AIAssistant })));
const Dashboard = lazy(() => import('./components/dashboard/Dashboard').then((m) => ({ default: m.Dashboard })));
const ReportExportModal = lazy(() => import('./components/reports/ReportExportModal').then((m) => ({ default: m.ReportExportModal })));
const AppBlueprintModal = lazy(() => import('./components/common/AppBlueprintModal').then((m) => ({ default: m.AppBlueprintModal })));
const PreClimbSafetyModal = lazy(() => import('./components/common/PreClimbSafetyModal').then((m) => ({ default: m.PreClimbSafetyModal })));
const BackendCloudModal = lazy(() => import('./components/common/BackendCloudModal').then((m) => ({ default: m.BackendCloudModal })));
const LoginPage = lazy(() => import('./components/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const ShiftHandoverModal = lazy(() => import('./components/installation/ShiftHandoverModal').then((m) => ({ default: m.ShiftHandoverModal })));

const ModuleFallback = () => (
  <div role="status" className="p-6 text-sm text-slate-400">Loading module…</div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('DASHBOARD');
  const [activeUser, setActiveUser] = useState<UserProfile>(storage.getActiveUser());
  const [isOnline, setIsOnline] = useState<boolean>(storage.isOnline());
  const [queue, setQueue] = useState<OfflineQueueItem[]>(storage.getQueue());
  const [sunlightMode, setSunlightMode] = useState<boolean>(storage.getSunlightMode());
  const [language, setLanguage] = useState<'EN' | 'FIL'>(storage.getLanguage());

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(storage.getWorkOrders());
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(
    workOrders[0] || null
  );

  const [sites, setSites] = useState<Site[]>(storage.getSites());
  const [hops, setHops] = useState<Hop[]>(storage.getHops());
  const [photos, setPhotos] = useState<PhotoEvidence[]>(storage.getPhotos());
  const [inventory, setInventory] = useState<InventoryItem[]>(storage.getInventory());
  const [tickets, setTickets] = useState<TroubleshootingTicket[]>(storage.getTickets());
  const [approvals, setApprovals] = useState<TssrApprovalSheet>(storage.getTssrApprovals());

  // Modal states
  const [showSyncModal, setShowSyncModal] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [showBlueprintModal, setShowBlueprintModal] = useState<boolean>(false);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [showBackendCloudModal, setShowBackendCloudModal] = useState<boolean>(false);
  const [showShiftHandoverModal, setShowShiftHandoverModal] = useState<boolean>(false);
  const [selectedWorkOrderForSafety, setSelectedWorkOrderForSafety] = useState<WorkOrder | null>(null);
  const [photoCaptureSection, setPhotoCaptureSection] = useState<{
    code: string;
    title: string;
  } | null>(null);

  // Subscribe to storage changes
  useEffect(() => {
    const unsubscribe = storage.subscribe(() => {
      const user = storage.getActiveUser();
      setActiveUser(user);
      setIsOnline(storage.isOnline());
      setQueue(storage.getQueue());
      setSunlightMode(storage.getSunlightMode());
      setLanguage(storage.getLanguage());
      const updatedOrders = storage.getWorkOrders();
      setWorkOrders(updatedOrders);
      setSites(storage.getSites());
      setHops(storage.getHops());
      setPhotos(storage.getPhotos());
      setInventory(storage.getInventory());
      setTickets(storage.getTickets());
      setApprovals(storage.getTssrApprovals());

      // Sync active work order if updated
      setSelectedWorkOrder((prev) => {
        if (!prev) return updatedOrders[0] || null;
        const exists = updatedOrders.find((w) => w.id === prev.id);
        return exists || updatedOrders[0] || null;
      });
    });
    return () => {
      unsubscribe();
    };
  }, [selectedWorkOrder?.id]);

  const siteA = sites.find((s) => s.role === 'A') || sites[0] || null;
  const siteB = sites.find((s) => s.role === 'B') || sites[1] || null;
  const currentHop = hops[0] || null;

  // Safe fallback objects for toolkits and components when awaiting TSSR
  const displaySiteA = siteA || SEED_SITE_A;
  const displaySiteB = siteB || SEED_SITE_B;
  const displayHop = currentHop || SEED_HOP;
  const activeSite = selectedWorkOrder
    ? (selectedWorkOrder.siteRole === 'A' ? siteA : siteB)
    : (siteB || siteA);
  const displayActiveSite = activeSite || displaySiteB;

  // RBAC: Technicians and Climbers only see jobs assigned to them
  const canViewAllJobs = hasPermission(activeUser.role, 'VIEW_ALL_WORK_ORDERS');
  const accessibleWorkOrders = canViewAllJobs
    ? workOrders
    : workOrders.filter((wo) => wo.assigneeIds.includes(activeUser.id));

  const handleOpenPhotoCapture = (code: string, title: string) => {
    setPhotoCaptureSection({ code, title });
    setActiveTab('PHOTOS');
  };

  const handleToggleSunlight = () => {
    storage.setSunlightMode(!sunlightMode);
  };

  const handleToggleLanguage = () => {
    storage.setLanguage(language === 'EN' ? 'FIL' : 'EN');
  };

  // Sunlight mode is a theme on <html> (see styles/sunlight.css) that remaps the whole
  // palette, so every screen and modal switches together. Components therefore always
  // render their standard variant (componentSunlight) and need no per-component branches.
  const componentSunlight = false;
  useEffect(() => {
    document.documentElement.classList.toggle('sunlight', sunlightMode);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', sunlightMode ? '#ffffff' : '#020617');
  }, [sunlightMode]);

  return (
    <div className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0 flex flex-col font-sans bg-slate-950 text-slate-100 overflow-x-clip">
      {/* Top Application Header */}
      <Header
        activeUser={activeUser}
        isOnline={isOnline}
        queuedCount={queue.length}
        sunlightMode={componentSunlight}
        sunlightActive={sunlightMode}
        language={language}
        onToggleSunlight={handleToggleSunlight}
        onToggleLanguage={handleToggleLanguage}
        onOpenSyncModal={() => setShowSyncModal(true)}
        onOpenBlueprint={() => setShowBlueprintModal(true)}
        onOpenLoginModal={() => setShowLoginModal(true)}
        onOpenBackendCloud={() => setShowBackendCloudModal(true)}
        onOpenBatteryTelemetry={() => setActiveTab('TOOLS')}
        siteA={siteA}
        siteB={siteB}
        hop={currentHop}
      />

      {/* Offline Alert Strip */}
      {!isOnline && (
        <div
          role="status"
          className="bg-amber-950 text-amber-200 border-b border-amber-800 px-3 sm:px-4 py-1 text-sm font-semibold flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 min-w-0">
            <WifiOff className="w-4 h-4 shrink-0" aria-hidden />
            <span className="truncate sm:hidden">Offline · saving on this device</span>
            <span className="hidden sm:inline">
              Offline: field data and photos are saved on this device and sync when the network returns.
            </span>
          </div>
          <button
            onClick={() => setShowSyncModal(true)}
            className="shrink-0 min-h-9 px-3 rounded-md border border-amber-700 hover:bg-amber-900 font-mono text-xs"
          >
            Queue {queue.length}
          </button>
        </div>
      )}

      {/* RBAC Active Role Banner */}
      <div className="bg-slate-900 border-b border-slate-800 px-3 sm:px-4 lg:px-6 py-1.5 text-xs font-mono text-slate-300">
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex items-center gap-1 text-cyan-400 font-bold shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden />
              <span className="hidden sm:inline">RBAC ACTIVE:</span>
            </span>
            <span className="text-white font-bold truncate">{activeUser.name}</span>
            <span className="text-slate-400 shrink-0">({activeUser.role.replace(/_/g, ' ')})</span>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 min-w-0 truncate">
            {activeUser.role === 'TECHNICIAN' && (
              <span>Filter: Assigned Jobs Only ({accessibleWorkOrders.length}/{workOrders.length}) · Read-only Approvals</span>
            )}
            {activeUser.role === 'TOWER_CLIMBER' && (
              <span>Filter: Tower Climb Tasks Only · Gated by Climber License</span>
            )}
            {activeUser.role === 'REVIEWER' && (
              <span className="text-emerald-400 font-semibold">Clearance: QA Technical Approvals & TSSR Signoff Unlocked</span>
            )}
            {activeUser.role === 'SUPERVISOR' && (
              <span className="text-amber-400 font-semibold">Clearance: Safety Gate Signoff & On-Site Escalation</span>
            )}
            {activeUser.role === 'PROJECT_MANAGER' && (
              <span className="text-blue-400 font-semibold">Clearance: Full Scheduling, KPIs & Resource Allocation</span>
            )}
            {activeUser.role === 'ADMIN' && (
              <span className="text-purple-400 font-semibold">Clearance: Super Admin (Unrestricted System Overrides)</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Enterprise Desktop & Mobile Layout Container */}
      <div className="flex-1 flex w-full">
        {/* Enterprise Decorative Branding & Telemetry Sidebar (Desktop) */}
        <EnterpriseSidebar
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          activeUser={activeUser}
          isOnline={isOnline}
          queuedCount={queue.length}
          sunlightMode={componentSunlight}
          language={language}
          onToggleSunlight={handleToggleSunlight}
          onToggleLanguage={handleToggleLanguage}
          onOpenSyncModal={() => setShowSyncModal(true)}
          onOpenBlueprint={() => setShowBlueprintModal(true)}
          onOpenBackendCloud={() => setShowBackendCloudModal(true)}
          siteA={siteA}
          siteB={siteB}
          hop={currentHop}
        />

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0 w-full max-w-7xl mx-auto px-3 py-4 sm:p-5 lg:p-6">
          <Suspense fallback={<ModuleFallback />}>
        {/* TAB 1: JOBS / WORK ORDERS */}
        {activeTab === 'JOBS' && (
          <div className="space-y-4">
            {!selectedWorkOrder || workOrders.length === 0 ? (
              <div className="p-8 sm:p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center max-w-xl mx-auto space-y-4 my-8">
                <div className="w-16 h-16 rounded-2xl bg-blue-950/80 border border-blue-700/80 text-blue-400 flex items-center justify-center mx-auto shadow-inner">
                  <FileText className="w-8 h-8" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base sm:text-lg font-bold text-white uppercase tracking-tight">
                    No Active Work Orders (Awaiting TSSR Ingestion)
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
                    All previous TSSR data has been removed to test AI capabilities. When a Project Manager uploads a new TSSR dossier, the AI will automatically parse site geometry and generate assigned Work Orders with safety checkpoints and step checklists.
                  </p>
                </div>
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                  <button
                    onClick={() => setActiveTab('TSSR')}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold shadow flex items-center justify-center gap-2 transition-all"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload TSSR Dossier (Project Manager)</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Quick Job Type Switcher (Filtered by User Role Permissions!) */}
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
                    <span className="text-xs font-mono font-bold text-slate-400 uppercase">
                      ACTIVE JOB:
                    </span>
                    <span className="text-xs font-bold text-cyan-400">
                      {selectedWorkOrder.workOrderNumber} ({selectedWorkOrder.type})
                    </span>
                    <span className="text-xs text-slate-400">
                      Site {selectedWorkOrder.siteRole}: {selectedWorkOrder.siteId}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowReportModal(true)}
                      className="px-2.5 py-1 rounded text-xs font-mono whitespace-nowrap bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/70 flex items-center gap-1.5 shadow transition-colors"
                      title="Generate Official As-Built PDF Report with Selected Photo Evidence"
                    >
                      <FileText className="w-3.5 h-3.5 text-cyan-400" />
                      <span>As-Built Dossier PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowShiftHandoverModal(true)}
                      className="px-2.5 py-1 rounded text-xs font-mono whitespace-nowrap bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/70 flex items-center gap-1.5 shadow transition-colors"
                      title="Shift Handover Log - Record status updates & remaining tasks for incoming shifts"
                    >
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Shift Handover</span>
                      {selectedWorkOrder.shiftHandovers && selectedWorkOrder.shiftHandovers.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-xs bg-slate-800 text-cyan-300 font-bold">
                          {selectedWorkOrder.shiftHandovers.length}
                        </span>
                      )}
                    </button>

                    <div className="h-4 w-px bg-slate-800 mx-1 shrink-0" />

                    {accessibleWorkOrders.length === 0 ? (
                      <span className="text-xs text-slate-500 italic">No jobs assigned to this technician</span>
                    ) : (
                      accessibleWorkOrders.map((wo) => (
                        <button
                          key={wo.id}
                          onClick={() => setSelectedWorkOrder(wo)}
                          className={`px-2.5 py-1 rounded text-xs font-mono whitespace-nowrap transition-colors ${
                            selectedWorkOrder.id === wo.id
                              ? 'bg-cyan-600 text-white font-bold shadow'
                              : 'bg-slate-950 text-slate-400 hover:text-white'
                          }`}
                        >
                          {wo.type === 'INSTALLATION'
                            ? `Install Site ${wo.siteRole}`
                            : wo.type === 'DISMANTLING'
                            ? 'Dismantle'
                            : 'Troubleshoot'}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Guard Work Order Execution with RoleGate */}
                <RoleGate
                  currentUser={activeUser}
                  allowedRoles={['ADMIN', 'PROJECT_MANAGER', 'TEAM_LEADER', 'REVIEWER', 'SUPERVISOR', 'TECHNICIAN', 'TOWER_CLIMBER']}
                  sectionName="Work Order Execution"
                >
                  {selectedWorkOrder.type === 'INSTALLATION' && (
                    <InstallationWizard
                      workOrder={selectedWorkOrder}
                      site={displayActiveSite}
                      hop={displayHop}
                      activeUser={activeUser}
                      approvals={approvals}
                      onOpenPhotoCapture={handleOpenPhotoCapture}
                      onOpenReportModal={() => setShowReportModal(true)}
                      sunlightMode={componentSunlight}
                    />
                  )}

                  {selectedWorkOrder.type === 'DISMANTLING' && (
                    <DismantlingModule
                      site={displayActiveSite}
                      activeUser={activeUser}
                      inventory={inventory}
                      sunlightMode={componentSunlight}
                    />
                  )}

                  {selectedWorkOrder.type === 'TROUBLESHOOTING' && (
                    <TroubleshootingModule
                      site={displayActiveSite}
                      hop={displayHop}
                      activeUser={activeUser}
                      tickets={tickets}
                      sunlightMode={componentSunlight}
                    />
                  )}
                </RoleGate>
              </>
            )}
          </div>
        )}

        {/* TAB 2: MICROWAVE FIELD TOOLS */}
        {activeTab === 'TOOLS' && (
          <ToolsPage
            siteA={displaySiteA}
            siteB={displaySiteB}
            hop={displayHop}
            sunlightMode={componentSunlight}
          />
        )}

        {/* TAB 3: PHOTO EVIDENCE ENGINE */}
        {activeTab === 'PHOTOS' && (
          <PhotoEngine
            site={displayActiveSite}
            activeUser={activeUser}
            photos={photos}
            targetSectionCode={photoCaptureSection?.code}
            onCloseCapture={() => setPhotoCaptureSection(null)}
            sunlightMode={componentSunlight}
          />
        )}

        {/* TAB 4: TSSR & APPROVAL ROUTING */}
        {activeTab === 'TSSR' && (
          <TssrModule
            siteA={siteA}
            siteB={siteB}
            hop={currentHop}
            approvals={approvals}
            activeUser={activeUser}
            sunlightMode={componentSunlight}
            onNavigateToDashboard={() => setActiveTab('DASHBOARD')}
            onNavigateToJobs={() => setActiveTab('JOBS')}
          />
        )}

        {/* TAB 5: ASK FIELDOPS AI */}
        {activeTab === 'AI' && (
          <AIAssistant
            site={activeSite}
            hop={currentHop}
            workOrder={selectedWorkOrder}
            sunlightMode={componentSunlight}
            onNavigateToTssr={() => setActiveTab('TSSR')}
          />
        )}

        {/* TAB 6: DASHBOARD & LANDING PAGE */}
        {activeTab === 'DASHBOARD' && (
          <Dashboard
            workOrders={workOrders}
            siteA={siteA}
            siteB={siteB}
            hop={currentHop}
            photos={photos}
            inventory={inventory}
            tickets={tickets}
            activeUser={activeUser}
            onSelectWorkOrder={(wo) => {
              setSelectedWorkOrder(wo);
              setActiveTab('JOBS');
            }}
            onStartJob={(wo) => setSelectedWorkOrderForSafety(wo)}
            onNavigateToJobs={() => setActiveTab('JOBS')}
            onNavigateToTssr={() => setActiveTab('TSSR')}
            sunlightMode={componentSunlight}
          />
        )}
          </Suspense>
      </main>
      </div>

      <Suspense fallback={null}>
      {/* Mobile-First Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        sunlightMode={componentSunlight}
      />

      {/* Sync Status Modal */}
      <SyncModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        isOnline={isOnline}
        queue={queue}
      />

      {/* Official PDF Report Export Modal */}
      <ReportExportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        workOrder={selectedWorkOrder || SEED_WORK_ORDERS[0]}
        site={displayActiveSite}
        hop={displayHop}
        activeUser={activeUser}
        approvals={approvals}
        photos={photos}
      />

      {/* Autonomous Application Blueprint & Changelog Modal */}
      <AppBlueprintModal
        isOpen={showBlueprintModal}
        onClose={() => setShowBlueprintModal(false)}
      />

      {/* Pre-Climb Safety Check Modal */}
      {selectedWorkOrderForSafety && (
        <PreClimbSafetyModal
          isOpen={Boolean(selectedWorkOrderForSafety)}
          onClose={() => setSelectedWorkOrderForSafety(null)}
          workOrder={selectedWorkOrderForSafety}
          site={selectedWorkOrderForSafety.siteRole === 'A' ? displaySiteA : displaySiteB}
          activeUser={activeUser}
          onStartJobConfirmed={async (safetyData) => {
            const wo = selectedWorkOrderForSafety;
            const updatedWo: WorkOrder = {
              ...wo,
              status: 'IN_PROGRESS',
              startedAt: new Date().toISOString(),
              history: [
                ...(wo.history || []),
                {
                  timestamp: new Date().toISOString(),
                  userId: activeUser.id,
                  userName: activeUser.name,
                  action: 'STARTED_JOB_WITH_PRE_CLIMB_SAFETY_CHECK',
                  note: `PPE verified: ${safetyData.ppeItems.join(', ')}. Hazards acknowledged: ${safetyData.hazardItems.join(', ')}. Signed by: ${safetyData.signature}`,
                },
              ],
            };
            await storage.saveWorkOrder(updatedWo);
            storage.logAudit(
              'WORK_ORDER_STARTED',
              updatedWo.id,
              'WORK_ORDER',
              `Started work order ${updatedWo.workOrderNumber} after Pre-Climb Safety Check sign-off by ${safetyData.signature}`
            );
            setSelectedWorkOrder(updatedWo);
            setActiveTab('JOBS');
            setSelectedWorkOrderForSafety(null);
          }}
          sunlightMode={componentSunlight}
        />
      )}

      {/* Login & Role Switcher Page Modal */}
      {showLoginModal && (
        <LoginPage
          onLoginSuccess={(user, targetFlowStep) => {
            setActiveUser(user);
            setShowLoginModal(false);
            if (targetFlowStep) {
              setActiveTab(targetFlowStep);
            } else if (user.role === 'PROJECT_MANAGER') {
              setActiveTab('TSSR');
            } else {
              setActiveTab('DASHBOARD');
            }
          }}
          onClose={() => setShowLoginModal(false)}
        />
      )}

      {/* Backend & Cloud Infrastructure Console Modal */}
      <BackendCloudModal
        isOpen={showBackendCloudModal}
        onClose={() => setShowBackendCloudModal(false)}
        sunlightMode={componentSunlight}
      />

      {/* Global Shift Handover Modal for Selected Work Order */}
      {showShiftHandoverModal && selectedWorkOrder && (
        <ShiftHandoverModal
          isOpen={showShiftHandoverModal}
          onClose={() => setShowShiftHandoverModal(false)}
          workOrder={selectedWorkOrder}
          site={activeSite}
          activeUser={activeUser}
          sunlightMode={componentSunlight}
        />
      )}
      </Suspense>
    </div>
  );
}
