import React, { useState, useEffect, useMemo } from 'react';
import {
  Radio,
  Wifi,
  WifiOff,
  Sun,
  ShieldAlert,
  UserCheck,
  RefreshCw,
  Globe,
  Sliders,
  ChevronDown,
  FileText,
  Server,
  Battery,
  BatteryCharging,
  BatteryWarning,
  X,
  Zap,
  Thermometer,
  Activity,
  Clock,
  HeartPulse,
  ExternalLink,
  ShieldCheck,
  Compass,
} from 'lucide-react';
import { storage } from '../../services/storageService';
import { deviceBatteryService } from '../../services/deviceBatteryService';
import { UserProfile, UserRole, DeviceBatteryState, Site, Hop } from '../../types/fieldops';
import { BatteryTelemetry } from '../tools/BatteryTelemetry';

interface HeaderProps {
  activeUser: UserProfile;
  isOnline: boolean;
  queuedCount: number;
  sunlightMode: boolean;
  language: 'EN' | 'FIL';
  onToggleSunlight: () => void;
  onToggleLanguage: () => void;
  onOpenSyncModal: () => void;
  onOpenBlueprint?: () => void;
  onOpenLoginModal?: () => void;
  onOpenBackendCloud?: () => void;
  onOpenBatteryTelemetry?: () => void;
  siteA?: Site;
  siteB?: Site;
  hop?: Hop;
}

export const Header: React.FC<HeaderProps> = ({
  activeUser,
  isOnline,
  queuedCount,
  sunlightMode,
  language,
  onToggleSunlight,
  onToggleLanguage,
  onOpenSyncModal,
  onOpenBlueprint,
  onOpenLoginModal,
  onOpenBackendCloud,
  onOpenBatteryTelemetry,
  siteA,
  siteB,
  hop,
}) => {
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showBatteryModal, setShowBatteryModal] = useState(false);
  const [showBatteryTooltip, setShowBatteryTooltip] = useState(false);
  const [deviceBattery, setDeviceBattery] = useState<DeviceBatteryState>(() =>
    deviceBatteryService.getState()
  );

  useEffect(() => {
    const unsub = deviceBatteryService.subscribe((state) => {
      setDeviceBattery(state);
    });
    return () => unsub();
  }, []);

  // Keyboard shortcut listener: ESC to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowBatteryModal(false);
        setShowBatteryTooltip(false);
        setShowRoleMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Dynamic visual styling & color changing based on remaining charge and charging state
  const batteryVisual = useMemo(() => {
    const level = deviceBattery.level;
    const charging = deviceBattery.charging;
    const alertLevel = deviceBattery.alertLevel;

    if (charging) {
      return {
        fillColor: '#10b981', // emerald-500
        strokeColor: '#34d399', // emerald-400
        textColor: 'text-emerald-400',
        badgeBg: sunlightMode
          ? 'bg-emerald-100 text-emerald-950 border-emerald-600 font-bold'
          : 'bg-emerald-950/70 text-emerald-300 border-emerald-600/80',
        dotColor: 'bg-emerald-400',
        pulse: 'animate-pulse',
        statusLabel: 'Charging',
      };
    }
    if (level <= 10 || alertLevel === 'EMERGENCY') {
      return {
        fillColor: '#e11d48', // rose-600
        strokeColor: '#f43f5e', // rose-500
        textColor: 'text-rose-400',
        badgeBg: sunlightMode
          ? 'bg-rose-200 text-rose-950 border-rose-600 font-black'
          : 'bg-rose-950/90 text-rose-300 border-rose-500',
        dotColor: 'bg-rose-500',
        pulse: 'animate-pulse',
        statusLabel: 'Emergency (<10%)',
      };
    }
    if (level <= 20 || alertLevel === 'CRITICAL') {
      return {
        fillColor: '#ea580c', // orange-600
        strokeColor: '#fb923c', // orange-400
        textColor: 'text-orange-400',
        badgeBg: sunlightMode
          ? 'bg-orange-200 text-orange-950 border-orange-600 font-bold'
          : 'bg-orange-950/80 text-orange-300 border-orange-500',
        dotColor: 'bg-orange-400',
        pulse: 'animate-pulse',
        statusLabel: 'Critical (<20%)',
      };
    }
    if (level <= 45 || alertLevel === 'ADVISORY') {
      return {
        fillColor: '#d97706', // amber-600
        strokeColor: '#fbbf24', // amber-400
        textColor: 'text-amber-400',
        badgeBg: sunlightMode
          ? 'bg-amber-200 text-amber-950 border-amber-600 font-bold'
          : 'bg-amber-950/70 text-amber-300 border-amber-600/80',
        dotColor: 'bg-amber-400',
        pulse: '',
        statusLabel: 'Advisory (<45%)',
      };
    }
    if (level <= 75) {
      return {
        fillColor: '#0891b2', // cyan-600
        strokeColor: '#22d3ee', // cyan-400
        textColor: 'text-cyan-400',
        badgeBg: sunlightMode
          ? 'bg-cyan-100 text-cyan-950 border-cyan-600 font-bold'
          : 'bg-cyan-950/60 text-cyan-300 border-cyan-700/80',
        dotColor: 'bg-cyan-400',
        pulse: '',
        statusLabel: 'Nominal (45-75%)',
      };
    }
    return {
      fillColor: '#16a34a', // green-600
      strokeColor: '#4ade80', // green-400
      textColor: 'text-emerald-400',
      badgeBg: sunlightMode
        ? 'bg-emerald-100 text-emerald-950 border-emerald-600 font-bold'
        : 'bg-emerald-950/60 text-emerald-300 border-emerald-700/80',
      dotColor: 'bg-emerald-400',
      pulse: '',
      statusLabel: 'Optimal (>75%)',
    };
  }, [deviceBattery.level, deviceBattery.charging, deviceBattery.alertLevel, sunlightMode]);

  // Format remaining minutes into human-readable format
  const formatMinutesRemaining = (mins: number | null) => {
    if (mins === null || isNaN(mins)) return 'Calculating...';
    if (mins <= 0) return 'Depleted';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m left`;
    return `${h}h ${m}m left`;
  };
  const users = storage.getAllUsers();

  const handleSelectUser = (user: UserProfile) => {
    storage.setActiveUser(user);
    setShowRoleMenu(false);
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-900 text-purple-200 border-purple-700';
      case 'PROJECT_MANAGER':
        return 'bg-blue-900 text-blue-200 border-blue-700';
      case 'REVIEWER':
        return 'bg-emerald-900 text-emerald-200 border-emerald-700';
      case 'SUPERVISOR':
        return 'bg-amber-900 text-amber-200 border-amber-700';
      case 'TOWER_CLIMBER':
        return 'bg-rose-900 text-rose-200 border-rose-700';
      case 'TECHNICIAN':
      default:
        return 'bg-cyan-900 text-cyan-200 border-cyan-700';
    }
  };

  const toggleOnlineMode = () => {
    storage.setSimulatedOnline(!isOnline);
  };

  return (
    <header
      className={`sticky top-0 z-40 transition-colors border-b w-full ${
        sunlightMode
          ? 'bg-amber-100 border-amber-300 text-neutral-900 shadow-sm'
          : 'bg-slate-950/95 backdrop-blur-md border-slate-800 text-slate-100 shadow-lg shadow-black/40'
      }`}
    >
      <div className="w-full px-3 sm:px-4 lg:px-6 py-2 flex items-center justify-between gap-3">
        {/* Left Section: Enterprise Brand & Sidebar Alignment Footprint */}
        <div className="w-auto lg:w-64 xl:w-72 shrink-0 flex items-center justify-between lg:border-r border-slate-800/80 lg:pr-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center text-white shadow-md shadow-cyan-950/40 shrink-0">
              <Radio className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold tracking-tight text-sm uppercase text-cyan-400">
                  FieldOps
                </span>
                <span className="text-[10px] px-1 py-0.2 rounded font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                  MW
                </span>
              </div>
              <p className="text-[9px] text-slate-400 font-mono tracking-wide hidden sm:block">
                Microwave Field Operations
              </p>
            </div>
          </div>

          {/* Telecom Status Pill (Desktop only) */}
          <div className="hidden xl:flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] font-bold">11GHz XPIC</span>
          </div>
        </div>

        {/* Center Section: Active Microwave Hop Context & Telemetry */}
        <div className="hidden md:flex items-center gap-2.5 px-3 flex-1 min-w-0">
          {storage.hasActiveTssr() ? (
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300 truncate">
              <span className="text-cyan-400 font-bold flex items-center gap-1 shrink-0">
                <Compass className="w-3.5 h-3.5" />
                {hop?.hopName || 'Active Microwave Hop'}
              </span>
              <span className="text-slate-600">·</span>
              <span className="truncate text-slate-300">
                {siteA?.name || 'Site A'} <span className="text-cyan-400 mx-0.5">↔</span> {siteB?.name || 'Site B'}
              </span>
              <span className="text-slate-600 hidden lg:inline">·</span>
              <span className="text-emerald-400 font-semibold hidden lg:inline">
                RSL: {hop?.expectedRslDbm || -27.2} dBm
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-700/80 text-amber-300 font-bold text-[10px] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                AWAITING TSSR INGESTION
              </span>
              <span className="text-slate-400 text-[11px] hidden lg:inline">
                Clean Slate: Project Manager upload required to bind Hop & Work Orders
              </span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Online/Offline Toggle Button */}
          <button
            onClick={toggleOnlineMode}
            title={isOnline ? 'Online (Click to simulate offline field mode)' : 'Offline (Click to go online)'}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-mono font-semibold transition-colors border ${
              isOnline
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80 hover:bg-emerald-900/60'
                : 'bg-amber-950/80 text-amber-300 border-amber-700 animate-pulse hover:bg-amber-900'
            }`}
          >
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden xs:inline">ONLINE</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-bold">OFFLINE</span>
              </>
            )}
          </button>

          {/* Handheld Device Battery Telemetry Badge with Dynamic Color & Tooltip */}
          <div
            className="relative"
            onMouseEnter={() => setShowBatteryTooltip(true)}
            onMouseLeave={() => setShowBatteryTooltip(false)}
          >
            <button
              onClick={() => {
                setShowBatteryTooltip(false);
                setShowBatteryModal(true);
                if (onOpenBatteryTelemetry) {
                  // Keep optional parent callback available if needed
                }
              }}
              onFocus={() => setShowBatteryTooltip(true)}
              onBlur={() => setShowBatteryTooltip(false)}
              aria-label={`Handheld battery ${deviceBattery.level}% ${batteryVisual.statusLabel}`}
              title={`Handheld Device Battery: ${deviceBattery.level}% · ${batteryVisual.statusLabel} (${deviceBattery.charging ? 'Charging' : 'Discharging'}) · Click for Full Telemetry`}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono font-semibold transition-all border shadow-sm ${batteryVisual.badgeBg} ${batteryVisual.pulse}`}
            >
              {/* Dynamic SVG Battery Meter */}
              <svg
                className="w-5 h-3 shrink-0"
                viewBox="0 0 24 13"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Outer casing */}
                <rect
                  x="0.75"
                  y="0.75"
                  width="19.5"
                  height="11.5"
                  rx="2.25"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className={batteryVisual.textColor}
                />
                {/* Battery terminal positive nipple */}
                <path
                  d="M22 4.25C22.69 4.25 23.25 4.81 23.25 5.5V7.5C23.25 8.19 22.69 8.75 22 8.75"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  className={batteryVisual.textColor}
                />
                {/* Inner fill bar scaled proportionally to remaining charge */}
                <rect
                  x="2.5"
                  y="2.5"
                  width={Math.max(1.5, Math.min(16, (deviceBattery.level / 100) * 16))}
                  height="8"
                  rx="1"
                  fill={batteryVisual.fillColor}
                  className={deviceBattery.charging ? 'animate-pulse' : ''}
                />
                {/* Lightning bolt glyph if charging */}
                {deviceBattery.charging && (
                  <path
                    d="M11 1.5L7.5 7H11.5L9 11.5L14.5 5.5H10.5L11 1.5Z"
                    fill="#ffffff"
                    stroke="#022c22"
                    strokeWidth="0.5"
                  />
                )}
              </svg>

              <span className={`font-mono text-xs ${deviceBattery.level <= deviceBattery.criticalThreshold ? 'font-bold' : ''}`}>
                {deviceBattery.level}%
              </span>

              {/* Mini pulse dot for critical tower warning */}
              {deviceBattery.level <= deviceBattery.criticalThreshold && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
              )}
            </button>

            {/* Hover Tooltip showing detailed health telemetry */}
            {showBatteryTooltip && !showBatteryModal && (
              <div
                role="tooltip"
                className={`absolute right-0 top-full mt-2 w-72 sm:w-80 rounded-xl shadow-2xl p-3.5 z-50 pointer-events-auto border transition-all animate-fadeIn ${
                  sunlightMode
                    ? 'bg-amber-50 border-amber-400 text-neutral-900 shadow-amber-950/20'
                    : 'bg-slate-900/95 backdrop-blur-md border-slate-700 text-slate-100 shadow-black/80'
                }`}
              >
                {/* Tooltip Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <HeartPulse className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold font-mono tracking-wider">BATTERY TELEMETRY</span>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${batteryVisual.badgeBg}`}>
                    {batteryVisual.statusLabel}
                  </span>
                </div>

                {/* Big charge meter and state */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-2xl font-black font-mono ${batteryVisual.textColor}`}>
                      {deviceBattery.level}%
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {deviceBattery.charging ? 'Charging' : 'Discharging'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {deviceBattery.batteryHealthScore}% Health
                    </span>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {deviceBattery.healthStatus}
                    </div>
                  </div>
                </div>

                {/* Charge bar */}
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-3 border border-slate-700/50">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${deviceBattery.level}%`,
                      backgroundColor: batteryVisual.fillColor,
                    }}
                  />
                </div>

                {/* Telemetry specs grid */}
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono mb-3 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                  <div>
                    <span className="text-slate-400 flex items-center gap-1 text-[10px]">
                      <Clock className="w-3 h-3 text-cyan-400" /> Runtime
                    </span>
                    <span className="text-slate-200 font-semibold">
                      {formatMinutesRemaining(deviceBattery.estimatedMinutesRemaining)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 flex items-center gap-1 text-[10px]">
                      <Activity className="w-3 h-3 text-cyan-400" /> Drain Rate
                    </span>
                    <span className="text-slate-200 font-semibold">
                      {deviceBattery.dischargeRatePerHour > 0 ? '-' : ''}
                      {Math.abs(deviceBattery.dischargeRatePerHour).toFixed(1)}%/hr
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 flex items-center gap-1 text-[10px]">
                      <Thermometer className="w-3 h-3 text-cyan-400" /> Core Temp
                    </span>
                    <span className="text-slate-200 font-semibold">
                      {deviceBattery.temperatureC.toFixed(1)}°C · Safe
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 flex items-center gap-1 text-[10px]">
                      <Zap className="w-3 h-3 text-cyan-400" /> Safety Gate
                    </span>
                    <span className={`font-semibold ${
                      deviceBattery.alertLevel === 'EMERGENCY'
                        ? 'text-rose-400 font-bold'
                        : deviceBattery.alertLevel === 'CRITICAL'
                        ? 'text-orange-400 font-bold'
                        : deviceBattery.alertLevel === 'ADVISORY'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}>
                      {deviceBattery.alertLevel}
                    </span>
                  </div>
                </div>

                {/* Click CTA to open modal */}
                <button
                  onClick={() => {
                    setShowBatteryTooltip(false);
                    setShowBatteryModal(true);
                  }}
                  className="w-full py-1.5 px-2 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-700/70 text-cyan-200 text-[11px] font-bold font-mono flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Open Full BatteryTelemetry™ Suite</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Sync Queue Badge Button */}
          <button
            onClick={onOpenSyncModal}
            title="Sync Status & Offline Queue"
            className={`relative flex items-center justify-center p-1.5 rounded border transition-colors ${
              queuedCount > 0
                ? 'bg-amber-900/50 text-amber-300 border-amber-600'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${queuedCount > 0 ? 'animate-spin' : ''}`} />
            {queuedCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-slate-950 font-bold text-[9px] rounded-full flex items-center justify-center">
                {queuedCount}
              </span>
            )}
          </button>

          {/* App Blueprint & Changelog Button */}
          <button
            onClick={onOpenBlueprint}
            title="Application Blueprint & Changelog"
            className="flex items-center gap-1 px-2 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-800 hover:border-cyan-700/60 text-xs font-mono font-semibold transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Blueprint</span>
          </button>

          {/* Server Architecture & Cloud Infrastructure Button */}
          <button
            onClick={onOpenBackendCloud}
            title="Server Logic, APIs & Cloud Infrastructure Console"
            className="flex items-center gap-1 px-2 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-purple-400 border border-slate-800 hover:border-purple-700/60 text-xs font-mono font-semibold transition-colors"
          >
            <Server className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Server & Cloud</span>
          </button>

          {/* High Contrast / Sunlight Mode */}
          <button
            onClick={onToggleSunlight}
            title={sunlightMode ? 'Turn off Sunlight Mode' : 'High Contrast Sunlight Mode (for tower work)'}
            className={`p-1.5 rounded border transition-colors ${
              sunlightMode
                ? 'bg-yellow-400 text-slate-950 border-yellow-500 font-bold'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-yellow-400'
            }`}
          >
            <Sun className="w-4 h-4" />
          </button>

          {/* Language Switcher */}
          <button
            onClick={onToggleLanguage}
            title="Switch Language (EN / Filipino)"
            className="flex items-center gap-1 px-1.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-mono"
          >
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span>{language}</span>
          </button>

          {/* Role Switcher Dropdown (Allows testing RBAC easily!) */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900 border border-slate-800 text-xs text-slate-200 hover:border-slate-700"
            >
              <div className="w-5 h-5 rounded-full bg-cyan-700 text-[10px] font-bold flex items-center justify-center text-white">
                {activeUser.name.charAt(0)}
              </div>
              <div className="text-left hidden md:block">
                <p className="font-semibold text-xs leading-none">{activeUser.name}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{activeUser.role.replace('_', ' ')}</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 mt-1.5 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-xl shadow-black/80 py-1.5 z-50">
                <div className="px-3 py-1.5 border-b border-slate-800 text-[11px] text-slate-400 font-mono flex items-center justify-between">
                  <span>SWITCH USER / ROLE</span>
                  <span className="text-[10px] text-cyan-400">RBAC Demo</span>
                </div>
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleSelectUser(u)}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-800 transition-colors ${
                      activeUser.id === u.id ? 'bg-slate-800/80' : ''
                    }`}
                  >
                    <div>
                      <p className="text-xs font-medium text-slate-200">{u.name}</p>
                      <p className="text-[10px] text-slate-400">{u.email}</p>
                    </div>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold border ${getRoleBadgeColor(
                        u.role
                      )}`}
                    >
                      {u.role.replace('_', ' ')}
                    </span>
                  </button>
                ))}
                {onOpenLoginModal && (
                  <div className="p-2 border-t border-slate-800 mt-1">
                    <button
                      onClick={() => {
                        setShowRoleMenu(false);
                        onOpenLoginModal();
                      }}
                      className="w-full py-2 px-3 bg-cyan-950 hover:bg-cyan-900 text-cyan-200 text-xs font-bold rounded border border-cyan-800 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span>🔐 Open Full Login & Role Gateway</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Battery Telemetry & Tower Safety Modal */}
      {showBatteryModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowBatteryModal(false);
            }
          }}
        >
          <div
            className={`relative w-full max-w-5xl my-auto rounded-2xl shadow-2xl border overflow-hidden flex flex-col max-h-[92vh] ${
              sunlightMode
                ? 'bg-amber-50 border-amber-400 text-neutral-900 shadow-amber-950/20'
                : 'bg-slate-900 border-slate-700 text-slate-100 shadow-2xl shadow-black/90'
            }`}
          >
            {/* Modal Header */}
            <div
              className={`px-4 sm:px-6 py-3.5 border-b flex items-center justify-between gap-3 shrink-0 ${
                sunlightMode ? 'bg-amber-100 border-amber-300' : 'bg-slate-950 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg border ${batteryVisual.badgeBg}`}>
                  {deviceBattery.charging ? (
                    <BatteryCharging className="w-5 h-5 text-emerald-400" />
                  ) : deviceBattery.level <= deviceBattery.criticalThreshold ? (
                    <BatteryWarning className="w-5 h-5 text-rose-400" />
                  ) : (
                    <Battery className="w-5 h-5 text-cyan-400" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold tracking-tight">
                      Handheld Device Battery Telemetry & Tower Safety
                    </h2>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${batteryVisual.badgeBg}`}>
                      {deviceBattery.level}% · {batteryVisual.statusLabel}
                    </span>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800 hidden sm:inline">
                      Web Battery API
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Real-time hardware discharge curves · Health analysis · Rigging auto-save thresholds
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {onOpenBatteryTelemetry && (
                  <button
                    onClick={() => {
                      setShowBatteryModal(false);
                      onOpenBatteryTelemetry();
                    }}
                    title="Open dedicated Tools page"
                    className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 font-mono transition-colors"
                  >
                    <span>Tools Workspace</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setShowBatteryModal(false)}
                  aria-label="Close battery telemetry modal"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body - renders the full BatteryTelemetry component */}
            <div className="p-3 sm:p-5 overflow-y-auto flex-1">
              <BatteryTelemetry
                sunlightMode={sunlightMode}
                siteName="Tower Site A - Catangnan MW Hub"
                technicianRole={activeUser.role}
                onEmergencyPersist={() => storage.flushToEdgeStorage()}
              />
            </div>

            {/* Modal Footer */}
            <div
              className={`px-4 sm:px-6 py-2.5 border-t flex items-center justify-between text-xs font-mono shrink-0 ${
                sunlightMode
                  ? 'bg-amber-100 border-amber-300 text-neutral-800'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[11px]">IndexedDB 4.x Local Edge Safeguard Active</span>
              </div>
              <button
                onClick={() => setShowBatteryModal(false)}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
