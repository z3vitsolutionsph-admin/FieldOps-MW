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
} from 'lucide-react';
import { ActiveTab } from './BottomNav';
import { UserProfile, Site, Hop } from '../../types/fieldops';

interface EnterpriseSidebarProps {
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
}) => {
  const navItems: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }>; section: string }[] = [
    { id: 'DASHBOARD', label: 'Operations Overview', icon: BarChart3, section: 'MISSION CONTROL' },
    { id: 'JOBS', label: 'Work Orders & Rigging', icon: Briefcase, section: 'MISSION CONTROL' },
    { id: 'TOOLS', label: 'Antenna Alignment HUD', icon: Wrench, section: 'TOWER TOOLS' },
    { id: 'PHOTOS', label: 'Evidence & Watermark', icon: Camera, section: 'QUALITY ASSURANCE' },
    { id: 'TSSR', label: 'TSSR 3-Gate Approval', icon: FileCheck, section: 'QUALITY ASSURANCE' },
    { id: 'AI', label: 'AI RF Diagnostics', icon: Bot, section: 'ENGINEERING' },
  ];

  return (
    <aside
      className={`hidden lg:flex flex-col w-64 xl:w-72 shrink-0 border-r transition-colors select-none ${
        sunlightMode
          ? 'bg-amber-100/90 border-amber-300 text-neutral-900'
          : 'bg-slate-950/95 border-slate-800 text-slate-100'
      }`}
    >
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
              onClick={() => onChangeTab('TSSR')}
              className="w-full py-1.5 px-2 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 font-bold text-[10px] flex items-center justify-center gap-1 transition-colors"
            >
              <span>Upload TSSR (PM)</span>
              <ArrowRight className="w-3 h-3" />
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
        <div className="space-y-1 text-[10px]">
          {activeUser.role === 'PROJECT_MANAGER' ? (
            <>
              <button
                onClick={() => onChangeTab('TSSR')}
                className={`w-full text-left px-2 py-1 rounded-md flex items-center justify-between transition-colors ${
                  activeTab === 'TSSR' ? 'bg-blue-600 text-white font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>1. Upload TSSR (Hop Data)</span>
                <span>➔</span>
              </button>
              <button
                onClick={() => onChangeTab('DASHBOARD')}
                className={`w-full text-left px-2 py-1 rounded-md flex items-center justify-between transition-colors ${
                  activeTab === 'DASHBOARD' ? 'bg-cyan-600 text-white font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>2. Dashboard & Crew Allocation</span>
                <span>➔</span>
              </button>
              <button
                onClick={() => onChangeTab('JOBS')}
                className={`w-full text-left px-2 py-1 rounded-md flex items-center justify-between transition-colors ${
                  activeTab === 'JOBS' ? 'bg-cyan-600 text-white font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>3. Jobs Schedule & Steps</span>
                <span>➔</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onChangeTab('DASHBOARD')}
                className={`w-full text-left px-2 py-1 rounded-md flex items-center justify-between transition-colors ${
                  activeTab === 'DASHBOARD' ? 'bg-cyan-600 text-white font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>1. Dashboard & Weather</span>
                <span>➔</span>
              </button>
              <button
                onClick={() => onChangeTab('JOBS')}
                className={`w-full text-left px-2 py-1 rounded-md flex items-center justify-between transition-colors ${
                  activeTab === 'JOBS' ? 'bg-cyan-600 text-white font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>2. Assigned Jobs & Rigging</span>
                <span>➔</span>
              </button>
              <button
                onClick={() => onChangeTab('TOOLS')}
                className={`w-full text-left px-2 py-1 rounded-md flex items-center justify-between transition-colors ${
                  activeTab === 'TOOLS' ? 'bg-cyan-600 text-white font-bold shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
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
                    onClick={() => onChangeTab(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all text-left ${
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
            onClick={onOpenSyncModal}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
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
            onClick={onOpenBlueprint}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Blueprint & Changelog</span>
            </span>
            <span className="text-[10px] text-slate-400">v3.6</span>
          </button>

          <button
            onClick={onOpenBackendCloud}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              <span>Backend & Cloud APIs</span>
            </span>
            <span className="text-[10px] text-purple-400">Cloud Run</span>
          </button>
        </div>
      </div>

      {/* Decorative Sidebar Footer: Active Operator Profile & Toggles */}
      <div className="p-3 border-t border-slate-800/80 space-y-2.5 bg-slate-950/80">
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
            className={`p-1.5 rounded-lg border flex items-center justify-center gap-1 transition-colors ${
              sunlightMode
                ? 'bg-yellow-400 text-slate-950 border-yellow-500 font-bold'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-yellow-400'
            }`}
            title="Toggle High-Contrast Sunlight Mode for 45m Tower"
          >
            <Sun className="w-3 h-3" />
            <span>{sunlightMode ? 'Sunlight' : 'Tactical'}</span>
          </button>

          <button
            onClick={onToggleLanguage}
            className="p-1.5 rounded-lg bg-slate-900 text-slate-300 border border-slate-800 hover:text-white flex items-center justify-center gap-1 transition-colors"
            title="Switch Language (EN / Filipino)"
          >
            <Globe className="w-3 h-3 text-cyan-400" />
            <span>{language}</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
