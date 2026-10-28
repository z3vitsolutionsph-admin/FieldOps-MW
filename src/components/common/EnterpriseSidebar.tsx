import React from 'react';
import {
  Briefcase,
  Wrench,
  Camera,
  FileCheck,
  Bot,
  BarChart3,
  Radio,
  Wifi,
  WifiOff,
  Sun,
  ShieldCheck,
  HardDrive,
  Compass,
  Activity,
  Layers,
  Zap,
  Globe,
  Sliders,
  Battery,
  Database,
  ArrowRight,
  AlertTriangle,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { ActiveTab } from './BottomNav';
import { UserProfile, Site, Hop } from '../../types/fieldops';

export interface EnterpriseSidebarProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  activeUser: UserProfile;
  isOnline: boolean;
  queuedCount: number;
  sunlightMode: boolean;
  language: 'EN' | 'FIL';
  onToggleSunlight: () => void;
  onToggleLanguage: () => void;
  onOpenSyncModal: () => void;
  onOpenBlueprint: () => void;
  onOpenBackendCloud: () => void;
  siteA?: Site | null;
  siteB?: Site | null;
  hop?: Hop | null;
  // Drawer & Collapse Props
  isMobileDrawerOpen?: boolean;
  onCloseDrawer?: () => void;
  isDesktopCollapsed?: boolean;
  onToggleDesktopCollapse?: () => void;
}

export const EnterpriseSidebar: React.FC<EnterpriseSidebarProps> = ({
  activeTab,
  onChangeTab,
  activeUser,
  isOnline,
  queuedCount,
  sunlightMode,
  language,
  onToggleSunlight,
  onToggleLanguage,
  onOpenSyncModal,
  onOpenBlueprint,
  onOpenBackendCloud,
  siteA,
  siteB,
  hop,
  isMobileDrawerOpen = false,
  onCloseDrawer,
  isDesktopCollapsed = false,
  onToggleDesktopCollapse,
}) => {
  const navItems: {
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    section: string;
  }[] = [
    { id: 'DASHBOARD', label: 'Operations Overview', icon: BarChart3, section: 'MISSION CONTROL' },
    { id: 'JOBS', label: 'Work Orders & Rigging', icon: Briefcase, section: 'MISSION CONTROL' },
    { id: 'TOOLS', label: 'Antenna Alignment HUD', icon: Wrench, section: 'TOWER TOOLS' },
    { id: 'PHOTOS', label: 'Evidence & Watermark', icon: Camera, section: 'QUALITY ASSURANCE' },
    { id: 'TSSR', label: 'TSSR 3-Gate Approval', icon: FileCheck, section: 'QUALITY ASSURANCE' },
    { id: 'AI', label: 'AI RF Diagnostics', icon: Bot, section: 'ENGINEERING' },
  ];

  const handleNavClick = (tab: ActiveTab) => {
    onChangeTab(tab);
    if (onCloseDrawer) {
      onCloseDrawer();
    }
  };

  const handleModalClick = (modalOpener: () => void) => {
    modalOpener();
    if (onCloseDrawer) {
      onCloseDrawer();
    }
  };

  // Reusable Sidebar Body Content
  const renderSidebarContent = () => (
    <>
      {/* Decorative Enterprise Microwave Link Telemetry Card */}
      <div className="p-3.5 border-b border-slate-800/80 space-y-2.5">
        <div className="flex items-center justify-between font-mono text-[11px]">
          <span className="text-slate-300 flex items-center gap-1.5 font-bold">
            <span
              className={`w-2 h-2 rounded-full ${
                siteA && siteB && hop ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
              }`}
            />
            MICROWAVE LINK
          </span>
          <span
            className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
              siteA && siteB && hop
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                : 'bg-amber-950 text-amber-300 border border-amber-800'
            }`}
          >
            {siteA && siteB && hop ? (hop.configuration || '11GHz XPIC') : 'AWAITING TSSR'}
          </span>
        </div>

        {/* Link Route Card */}
        {siteA && siteB && hop ? (
          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] font-mono space-y-1.5">
            <div className="flex items-center justify-between text-slate-200 font-bold">
              <span className="truncate">{siteA.id}</span>
              <span className="text-cyan-400 mx-1">↔</span>
              <span className="truncate">{siteB.id}</span>
            </div>

            <p className="text-[10px] text-slate-400 truncate">
              {hop.hopName || 'Microwave Backbone Link'}
            </p>

            <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-850 text-[9px] text-center text-slate-400">
              <div>
                <span className="block text-slate-500">BAND</span>
                <span className="text-slate-200 font-bold">
                  {hop.frequencyMHz ? `${(hop.frequencyMHz / 1000).toFixed(1)} GHz` : '11.2 GHz'}
                </span>
              </div>
              <div>
                <span className="block text-slate-500">RSL</span>
                <span className="text-emerald-400 font-bold">
                  {hop.expectedRslDbm ? `${hop.expectedRslDbm} dBm` : '-27.2 dBm'}
                </span>
              </div>
              <div>
                <span className="block text-slate-500">DIST</span>
                <span className="text-cyan-400 font-bold">
                  {hop.pathLengthKm ? `${hop.pathLengthKm} km` : '7.42 km'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-dashed border-slate-800 text-[11px] font-mono space-y-2">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[10px]">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>No Active Hop Data</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-normal">
              Previous TSSR data cleared. Upload a new TSSR to bind hop geometry.
            </p>
            <button
              onClick={() => handleNavClick('TSSR')}
              className="w-full py-2 px-2.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors min-h-[44px]"
            >
              <span>Upload TSSR (PM)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Role-Based User Flow Stepper Ribbon */}
      <div className="p-3 border-b border-slate-800/80 bg-slate-900/50 space-y-1.5 font-mono">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            {activeUser.role === 'PROJECT_MANAGER' ? 'PM User Flow' : 'Team Leader Flow'}
          </span>
          <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 font-bold border border-cyan-800">
            RBAC
          </span>
        </div>
        <div className="space-y-1 text-[11px]">
          {activeUser.role === 'PROJECT_MANAGER' ? (
            <>
              <button
                onClick={() => handleNavClick('TSSR')}
                className={`w-full text-left px-2.5 py-2 rounded-md flex items-center justify-between transition-colors min-h-[44px] ${
                  activeTab === 'TSSR'
                    ? 'bg-blue-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>1. Upload TSSR (Hop Data)</span>
                <span>➔</span>
              </button>
              <button
                onClick={() => handleNavClick('DASHBOARD')}
                className={`w-full text-left px-2.5 py-2 rounded-md flex items-center justify-between transition-colors min-h-[44px] ${
                  activeTab === 'DASHBOARD'
                    ? 'bg-cyan-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>2. Dashboard & Crew Allocation</span>
                <span>➔</span>
              </button>
              <button
                onClick={() => handleNavClick('JOBS')}
                className={`w-full text-left px-2.5 py-2 rounded-md flex items-center justify-between transition-colors min-h-[44px] ${
                  activeTab === 'JOBS'
                    ? 'bg-cyan-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>3. Jobs Schedule & Steps</span>
                <span>➔</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleNavClick('DASHBOARD')}
                className={`w-full text-left px-2.5 py-2 rounded-md flex items-center justify-between transition-colors min-h-[44px] ${
                  activeTab === 'DASHBOARD'
                    ? 'bg-cyan-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>1. Dashboard & Weather</span>
                <span>➔</span>
              </button>
              <button
                onClick={() => handleNavClick('JOBS')}
                className={`w-full text-left px-2.5 py-2 rounded-md flex items-center justify-between transition-colors min-h-[44px] ${
                  activeTab === 'JOBS'
                    ? 'bg-cyan-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>2. Assigned Jobs & Rigging</span>
                <span>➔</span>
              </button>
              <button
                onClick={() => handleNavClick('TOOLS')}
                className={`w-full text-left px-2.5 py-2 rounded-md flex items-center justify-between transition-colors min-h-[44px] ${
                  activeTab === 'TOOLS'
                    ? 'bg-cyan-600 text-white font-bold shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>3. Antenna HUD & Battery</span>
                <span>➔</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Primary Navigation Rail */}
      <div className="p-3 space-y-4 flex-1 overflow-y-auto">
        {['MISSION CONTROL', 'TOWER TOOLS', 'QUALITY ASSURANCE', 'ENGINEERING'].map((sec) => {
          const items = navItems.filter((i) => i.section === sec);
          if (items.length === 0) return null;
          return (
            <div key={sec} className="space-y-1">
              <div className="px-2 text-[9px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                {sec}
              </div>
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-mono font-bold transition-all text-left min-h-[44px] focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                      isActive
                        ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/40 translate-x-0.5'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </button>
                );
              })}
            </div>
          );
        })}

        {/* Quick System Consoles */}
        <div className="pt-2 border-t border-slate-800/80 space-y-1">
          <div className="px-2 text-[9px] font-mono font-bold tracking-wider text-slate-400 uppercase">
            SYSTEM CONSOLES
          </div>
          <button
            onClick={() => handleModalClick(onOpenSyncModal)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-900 transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <span className="flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              <span>Offline Sync Queue</span>
            </span>
            {queuedCount > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 font-mono">
                {queuedCount}
              </span>
            ) : (
              <span className="text-[10px] text-emerald-400">Synced</span>
            )}
          </button>

          <button
            onClick={() => handleModalClick(onOpenBlueprint)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-900 transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <span className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Blueprint & Changelog</span>
            </span>
            <span className="text-[10px] text-slate-400">v3.6</span>
          </button>

          <button
            onClick={() => handleModalClick(onOpenBackendCloud)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-900 transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" />
              <span>Backend & Cloud APIs</span>
            </span>
            <span className="text-[10px] text-purple-400">Cloud Run</span>
          </button>
        </div>
      </div>

      {/* Decorative Sidebar Footer: Active Operator Profile & Toggles */}
      <div className="p-3 border-t border-slate-800/80 space-y-2.5 bg-slate-950/80 shrink-0">
        {/* User Card */}
        <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-cyan-700 text-white font-bold text-xs flex items-center justify-center shrink-0">
            {activeUser.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-200 truncate">{activeUser.name}</p>
            <p className="text-[10px] text-slate-400 font-mono truncate">
              {activeUser.role.replace('_', ' ')}
            </p>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-400" title="RBAC Active" />
        </div>

        {/* Controls row: Sunlight Mode & Language */}
        <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
          <button
            onClick={onToggleSunlight}
            className={`p-2 rounded-lg border flex items-center justify-center gap-1 transition-colors min-h-[44px] ${
              sunlightMode
                ? 'bg-yellow-400 text-slate-950 border-yellow-500 font-bold'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-yellow-400'
            }`}
            title="Toggle High-Contrast Sunlight Mode for 45m Tower"
          >
            <Sun className="w-3.5 h-3.5" />
            <span>{sunlightMode ? 'Sunlight' : 'Tactical'}</span>
          </button>

          <button
            onClick={onToggleLanguage}
            className="p-2 rounded-lg bg-slate-900 text-slate-300 border border-slate-800 hover:text-white flex items-center justify-center gap-1 transition-colors min-h-[44px]"
            title="Switch Language (EN / Filipino)"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>{language}</span>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* 1. MOBILE SLIDE-OVER DRAWER OVERLAY & PANEL (Screens < lg) */}
      <div
        className={`fixed inset-0 bg-black/75 backdrop-blur-sm z-50 transition-opacity duration-300 lg:hidden ${
          isMobileDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onCloseDrawer}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 left-0 w-80 max-w-[85vw] z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out lg:hidden ${
          isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        } ${
          sunlightMode
            ? 'bg-amber-100 border-r border-amber-300 text-neutral-900'
            : 'bg-slate-950 border-r border-slate-800 text-slate-100'
        }`}
        aria-label="Mobile Navigation & Telemetry Drawer"
        role="dialog"
        aria-modal={isMobileDrawerOpen}
      >
        {/* Drawer Header Banner */}
        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0 bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center text-white shadow-md shrink-0">
              <Radio className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm uppercase text-cyan-400">
                  FieldOps
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                  MW
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                Navigation & Telemetry Drawer
              </p>
            </div>
          </div>

          <button
            onClick={onCloseDrawer}
            aria-label="Close navigation drawer"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-cyan-400 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Drawer Body */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          {renderSidebarContent()}
        </div>
      </aside>

      {/* 2. DESKTOP DOCKED SIDEBAR (Screens >= lg) */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 border-r transition-all duration-300 select-none ${
          isDesktopCollapsed ? 'w-0 overflow-hidden border-none' : 'w-64 xl:w-72'
        } ${
          sunlightMode
            ? 'bg-amber-100/90 border-amber-300 text-neutral-900'
            : 'bg-slate-950/95 border-slate-800 text-slate-100'
        }`}
        aria-label="Enterprise Telemetry & Operations Sidebar"
      >
        {/* Desktop Sidebar Collapse Header */}
        <div className="p-2.5 border-b border-slate-800/80 flex items-center justify-between shrink-0 bg-slate-950/60">
          <span className="text-[10px] font-mono text-slate-400 tracking-wider uppercase px-2 font-bold truncate">
            Sidebar Navigation
          </span>
          {onToggleDesktopCollapse && (
            <button
              onClick={onToggleDesktopCollapse}
              aria-label="Collapse sidebar to maximize workspace"
              title="Collapse sidebar to maximize workspace"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center min-h-[32px] min-w-[32px]"
            >
              <PanelLeftClose className="w-4 h-4 text-slate-400 hover:text-cyan-400 transition-colors" />
            </button>
          )}
        </div>

        {/* Desktop Scrollable Body */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          {renderSidebarContent()}
        </div>
      </aside>
    </>
  );
};
