import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import {
  Battery,
  BatteryCharging,
  BatteryWarning,
  AlertTriangle,
  ShieldAlert,
  Zap,
  Volume2,
  VolumeX,
  Vibrate,
  Sliders,
  RotateCcw,
  Download,
  Flame,
  Clock,
  ArrowDownRight,
  ArrowUpRight,
  HardDrive,
  Info,
  CheckCircle2,
  AlertOctagon,
  Smartphone,
  Eye,
  Radio,
  Share2,
} from 'lucide-react';
import {
  deviceBatteryService,
} from '../../services/deviceBatteryService';
import {
  DeviceBatteryState,
  DeviceBatteryLogPoint,
  DeviceBatteryAlertLevel,
} from '../../types/fieldops';
import { storage } from '../../services/storageService';

interface BatteryTelemetryProps {
  sunlightMode?: boolean;
  siteName?: string;
  technicianRole?: string;
  onEmergencyPersist?: () => void;
}

export const BatteryTelemetry: React.FC<BatteryTelemetryProps> = ({
  sunlightMode = false,
  siteName = 'Site B (Catangnan)',
  technicianRole = 'TOWER_CLIMBER',
  onEmergencyPersist,
}) => {
  // Service state
  const [batteryState, setBatteryState] = useState<DeviceBatteryState>(() =>
    deviceBatteryService.getState()
  );
  const [history, setHistory] = useState<DeviceBatteryLogPoint[]>(() =>
    deviceBatteryService.getHistory()
  );

  // UI Settings & Toggles
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [hapticEnabled, setHapticEnabled] = useState<boolean>(true);
  const [powerSaverActive, setPowerSaverActive] = useState<boolean>(false);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [showSimPanel, setShowSimPanel] = useState<boolean>(false);
  const [emergencySavedFeedback, setEmergencySavedFeedback] = useState<string | null>(null);

  // Threshold adjustments
  const [tempWarning, setTempWarning] = useState<number>(batteryState.warningThreshold);
  const [tempCritical, setTempCritical] = useState<number>(batteryState.criticalThreshold);
  const [tempEmergency, setTempEmergency] = useState<number>(batteryState.emergencyThreshold);

  // Subscribe to battery updates
  useEffect(() => {
    const unsub = deviceBatteryService.subscribe((state) => {
      setBatteryState(state);
      setHistory(deviceBatteryService.getHistory());
    });
    return () => unsub();
  }, []);

  // Alert trigger on threshold breach
  useEffect(() => {
    if (batteryState.alertLevel === 'EMERGENCY') {
      if (soundEnabled) deviceBatteryService.triggerAudioAlert('EMERGENCY');
      if (hapticEnabled) deviceBatteryService.triggerHapticAlert('EMERGENCY');
    } else if (batteryState.alertLevel === 'CRITICAL') {
      if (soundEnabled) deviceBatteryService.triggerAudioAlert('CRITICAL');
      if (hapticEnabled) deviceBatteryService.triggerHapticAlert('CRITICAL');
    } else if (batteryState.alertLevel === 'ADVISORY') {
      if (soundEnabled) deviceBatteryService.triggerAudioAlert('ADVISORY');
      if (hapticEnabled) deviceBatteryService.triggerHapticAlert('ADVISORY');
    }
  }, [batteryState.alertLevel, soundEnabled, hapticEnabled]);

  // Color & badge styling based on alert level
  const statusStyles = useMemo(() => {
    switch (batteryState.alertLevel) {
      case 'EMERGENCY':
        return {
          border: 'border-rose-600',
          bg: sunlightMode ? 'bg-rose-100' : 'bg-rose-950/40',
          text: 'text-rose-400',
          gaugeColor: '#e11d48',
          badgeBg: 'bg-rose-600 text-white',
          pulse: 'animate-pulse',
          title: 'EMERGENCY BATTERY LEVEL — IMMEDIATE ACTION REQUIRED',
          actionText: 'Connect portable power bank immediately. Auto-saving offline telemetry.',
        };
      case 'CRITICAL':
        return {
          border: 'border-orange-600',
          bg: sunlightMode ? 'bg-orange-100' : 'bg-orange-950/30',
          text: 'text-orange-400',
          gaugeColor: '#ea580c',
          badgeBg: 'bg-orange-600 text-white',
          pulse: '',
          title: 'CRITICAL BATTERY THRESHOLD — TOWER DESCENT ADVISORY',
          actionText: 'Prepare to suspend tower rigging. Save active link photos and queue work orders.',
        };
      case 'ADVISORY':
        return {
          border: 'border-amber-600',
          bg: sunlightMode ? 'bg-amber-100' : 'bg-amber-950/20',
          text: 'text-amber-400',
          gaugeColor: '#d97706',
          badgeBg: 'bg-amber-600 text-white',
          pulse: '',
          title: 'LOW BATTERY ADVISORY',
          actionText: 'Battery below 25%. Enable Tower Power Saver mode or prepare spare battery pack.',
        };
      case 'NOMINAL':
      default:
        return {
          border: 'border-emerald-600',
          bg: sunlightMode ? 'bg-emerald-50' : 'bg-slate-900',
          text: 'text-emerald-400',
          gaugeColor: '#10b981',
          badgeBg: 'bg-emerald-700 text-white',
          pulse: '',
          title: 'BATTERY OPERATING WITHIN SAFE PARAMETERS',
          actionText: 'Normal telemetry logging active. Tower climber handheld certified for rigging.',
        };
    }
  }, [batteryState.alertLevel, sunlightMode]);

  // Handle emergency data persist
  const handleEmergencyFlush = async () => {
    await storage.flushToEdgeStorage();
    if (onEmergencyPersist) {
      onEmergencyPersist();
    }
    setEmergencySavedFeedback('All pending work orders, photo queues & telemetry flushed to local edge storage.');
    setTimeout(() => setEmergencySavedFeedback(null), 4000);
  };

  // Export telemetry data
  const handleExportJSON = () => {
    const data = {
      exportTimestamp: new Date().toISOString(),
      siteName,
      technicianRole,
      currentState: batteryState,
      telemetryHistory: history,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fieldops-battery-telemetry-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Time', 'LevelPct', 'DischargeRatePerHour', 'Charging', 'TemperatureC', 'AlertLevel'];
    const rows = history.map((pt) => [
      pt.timestamp,
      `"${pt.timeStr}"`,
      pt.level,
      pt.dischargeRatePerHour,
      pt.charging ? 1 : 0,
      pt.temperatureC,
      pt.alertLevel,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fieldops-battery-log-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Save new thresholds
  const handleSaveThresholds = () => {
    deviceBatteryService.setThresholds(tempWarning, tempCritical, tempEmergency);
    setShowConfigModal(false);
  };

  // Format minutes into Hh Mm
  const formatMinutesRemaining = (mins: number | null) => {
    if (mins === null || isNaN(mins)) return 'Calculating...';
    if (mins <= 0) return 'Depleted';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m remaining`;
    return `${h}h ${m}m remaining`;
  };

  return (
    <div
      className={`space-y-4 rounded-xl border p-4 sm:p-5 transition-colors ${
        sunlightMode
          ? 'bg-amber-100/90 border-amber-300 text-neutral-900'
          : 'bg-slate-900/90 border-slate-800 text-slate-100'
      }`}
    >
      {/* Top Banner / Alert Bar */}
      <div
        className={`p-3.5 rounded-lg border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${statusStyles.bg} ${statusStyles.border} ${statusStyles.pulse}`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            {batteryState.alertLevel === 'EMERGENCY' ? (
              <AlertOctagon className="w-6 h-6 text-rose-500 animate-bounce" />
            ) : batteryState.alertLevel === 'CRITICAL' ? (
              <ShieldAlert className="w-6 h-6 text-orange-400" />
            ) : batteryState.alertLevel === 'ADVISORY' ? (
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            ) : (
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-sm tracking-tight">{statusStyles.title}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${statusStyles.badgeBg}`}>
                {batteryState.level}% · {batteryState.alertLevel}
              </span>
              {batteryState.isSimulated && (
                <span className="px-1.5 py-0.2 text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-700 rounded">
                  SIMULATOR ACTIVE
                </span>
              )}
            </div>
            <p className="text-xs opacity-85 mt-0.5">{statusStyles.actionText}</p>
          </div>
        </div>

        {/* Emergency Data Flush CTA */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            onClick={handleEmergencyFlush}
            className="flex-1 sm:flex-initial min-h-[44px] px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-rose-950/40 transition-transform active:scale-95"
            title="Force immediate cache flush to local edge storage"
          >
            <HardDrive className="w-4 h-4" />
            <span>Emergency Save</span>
          </button>
        </div>
      </div>

      {emergencySavedFeedback && (
        <div className="p-2.5 rounded bg-emerald-950 border border-emerald-600 text-emerald-200 text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{emergencySavedFeedback}</span>
        </div>
      )}

      {/* Main Telemetry Cockpit Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Large Battery Gauge Card */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between md:col-span-2 ${
            sunlightMode ? 'bg-amber-50 border-amber-300' : 'bg-slate-950 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-2.5">
            <div className="flex items-center gap-2">
              {batteryState.charging ? (
                <BatteryCharging className="w-5 h-5 text-emerald-400 animate-pulse" />
              ) : batteryState.level <= batteryState.criticalThreshold ? (
                <BatteryWarning className="w-5 h-5 text-rose-400" />
              ) : (
                <Battery className="w-5 h-5 text-cyan-400" />
              )}
              <span className="text-xs font-mono uppercase font-bold tracking-wider text-slate-400">
                Handheld Battery Status
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              API: {batteryState.isSupported ? 'Native Web Battery' : 'Emulated Fallback'}
            </span>
          </div>

          {/* Level Display */}
          <div className="py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-baseline gap-2">
              <span
                className="text-5xl sm:text-6xl font-black font-mono tracking-tighter"
                style={{ color: statusStyles.gaugeColor }}
              >
                {batteryState.level}%
              </span>
              <div className="text-xs font-mono space-y-0.5">
                <div className="font-bold text-white flex items-center gap-1">
                  {batteryState.charging ? (
                    <>
                      <Zap className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                      <span className="text-emerald-400">Charging</span>
                    </>
                  ) : (
                    <span className="text-slate-300">Discharging</span>
                  )}
                </div>
                <div className="text-slate-400">
                  {batteryState.charging ? 'Power Ingress' : 'Internal Cell Draw'}
                </div>
              </div>
            </div>

            {/* Visual Bar Indicator */}
            <div className="w-full sm:w-48 space-y-1.5">
              <div className="flex justify-between text-[11px] font-mono text-slate-400">
                <span>0%</span>
                <span className="text-amber-400 font-bold">25%</span>
                <span className="text-emerald-400 font-bold">100%</span>
              </div>
              <div className="h-4 w-full bg-slate-800 rounded-md overflow-hidden border border-slate-700/80 p-0.5 flex">
                <div
                  className="h-full rounded transition-all duration-500"
                  style={{
                    width: `${batteryState.level}%`,
                    backgroundColor: statusStyles.gaugeColor,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>Crit: {batteryState.criticalThreshold}%</span>
                <span>Warn: {batteryState.warningThreshold}%</span>
              </div>
            </div>
          </div>

          {/* Footer Metadata */}
          <div className="border-t border-slate-800/60 pt-2.5 flex items-center justify-between text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{formatMinutesRemaining(batteryState.estimatedMinutesRemaining)}</span>
            </span>
            <span>
              Health: <span className="font-bold text-emerald-400">{batteryState.healthStatus} ({batteryState.batteryHealthScore}%)</span>
            </span>
          </div>
        </div>

        {/* Discharge Rate Card */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            sunlightMode ? 'bg-amber-50 border-amber-300' : 'bg-slate-950 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
            <span className="text-xs font-mono uppercase font-bold tracking-wider text-slate-400">
              Discharge Rate
            </span>
            {batteryState.dischargeRatePerHour < 0 ? (
              <ArrowDownRight className="w-4 h-4 text-rose-400" />
            ) : (
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            )}
          </div>

          <div className="py-2">
            <div className="text-3xl font-extrabold font-mono tracking-tight text-white">
              {batteryState.dischargeRatePerHour > 0
                ? `+${batteryState.dischargeRatePerHour}`
                : batteryState.dischargeRatePerHour}
              <span className="text-xs font-sans text-slate-400 ml-1">%/hr</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {Math.abs(batteryState.dischargeRatePerHour) > 25
                ? 'High drain: Multiple sensors (GPS + Gyro + Max Brightness)'
                : 'Moderate drain: Normal telemetry profile'}
            </p>
          </div>

          <div className="border-t border-slate-800/60 pt-2 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Tower Target: &lt;18%/hr</span>
            <span
              className={
                Math.abs(batteryState.dischargeRatePerHour) > 22
                  ? 'text-amber-400 font-bold'
                  : 'text-emerald-400 font-bold'
              }
            >
              {Math.abs(batteryState.dischargeRatePerHour) > 22 ? 'HIGH DRAIN' : 'OPTIMAL'}
            </span>
          </div>
        </div>

        {/* Thermal & Outdoor Climate Card */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            sunlightMode ? 'bg-amber-50 border-amber-300' : 'bg-slate-950 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
            <span className="text-xs font-mono uppercase font-bold tracking-wider text-slate-400">
              Thermal Sensor
            </span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>

          <div className="py-2">
            <div className="text-3xl font-extrabold font-mono tracking-tight text-white">
              {batteryState.temperatureC}
              <span className="text-xs font-sans text-slate-400 ml-1">°C</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {batteryState.temperatureC > 38
                ? 'High heat: Direct solar radiation at tower elevation'
                : 'Safe operating temperature threshold'}
            </p>
          </div>

          <div className="border-t border-slate-800/60 pt-2 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Limit: 45.0°C</span>
            <span
              className={
                batteryState.temperatureC > 38
                  ? 'text-rose-400 font-bold'
                  : 'text-emerald-400 font-bold'
              }
            >
              {batteryState.temperatureC > 38 ? 'OVERHEAT RISK' : 'NORMAL'}
            </span>
          </div>
        </div>
      </div>

      {/* Control Buttons & Power Saver Row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        {/* Left Side: Audio, Haptics, Power Saver */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Audio Chime Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 transition-colors ${
              soundEnabled
                ? 'bg-slate-800 text-cyan-300 border-cyan-700/80'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
            title="Toggle Audible Battery Alerts"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4" />}
            <span>Sound {soundEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* Haptic Vibration Toggle */}
          <button
            onClick={() => setHapticEnabled(!hapticEnabled)}
            className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 transition-colors ${
              hapticEnabled
                ? 'bg-slate-800 text-amber-300 border-amber-700/80'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
            title="Toggle Haptic Vibration Alerts on Threshold Breach"
          >
            <Vibrate className="w-4 h-4 text-amber-400" />
            <span>Haptics {hapticEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* Tower Power Saver Mode */}
          <button
            onClick={() => setPowerSaverActive(!powerSaverActive)}
            className={`min-h-[44px] px-3 py-2 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 transition-colors ${
              powerSaverActive
                ? 'bg-emerald-950 text-emerald-300 border-emerald-600 shadow-md'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Toggle Tower Power Saver Mode (Throttles background pollers, dims non-essential animations)"
          >
            <Zap className={`w-4 h-4 ${powerSaverActive ? 'text-emerald-400 fill-emerald-400' : ''}`} />
            <span>Power Saver {powerSaverActive ? 'ACTIVE' : 'OFF'}</span>
          </button>
        </div>

        {/* Right Side: Config & Simulation Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowSimPanel(!showSimPanel)}
            className={`min-h-[44px] px-3 py-2 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 transition-colors ${
              showSimPanel
                ? 'bg-purple-900 text-white border-purple-500'
                : 'bg-slate-950 text-purple-400 border-slate-800 hover:border-purple-800'
            }`}
            title="Toggle Field Simulation & Rigging Testing Controls"
          >
            <Smartphone className="w-4 h-4" />
            <span>Simulator Controls</span>
          </button>

          <button
            onClick={() => setShowConfigModal(true)}
            className="min-h-[44px] px-3 py-2 rounded-lg bg-slate-950 text-slate-300 hover:text-white border border-slate-800 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors"
            title="Adjust Safety Thresholds"
          >
            <Sliders className="w-4 h-4" />
            <span>Thresholds</span>
          </button>

          <button
            onClick={handleExportJSON}
            className="min-h-[44px] px-3 py-2 rounded-lg bg-slate-950 text-cyan-400 hover:text-cyan-300 border border-slate-800 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors"
            title="Export JSON Telemetry Log"
          >
            <Download className="w-4 h-4" />
            <span>JSON</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="min-h-[44px] px-3 py-2 rounded-lg bg-slate-950 text-emerald-400 hover:text-emerald-300 border border-slate-800 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors"
            title="Export CSV Log"
          >
            <Download className="w-4 h-4" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Simulator Drawer Panel */}
      {showSimPanel && (
        <div
          className={`p-4 rounded-xl border space-y-3 ${
            sunlightMode ? 'bg-amber-100 border-amber-300' : 'bg-purple-950/20 border-purple-800/80'
          }`}
        >
          <div className="flex items-center justify-between border-b border-purple-800/40 pb-2">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-mono font-bold text-purple-300 uppercase">
                Field Rigging Simulation Suite (Manual Battery Injection)
              </span>
            </div>
            <button
              onClick={() => {
                deviceBatteryService.setSimulationMode(false);
                setShowSimPanel(false);
              }}
              className="text-[11px] font-mono text-purple-400 hover:underline"
            >
              Reset to Native API
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Simulate harsh tower battery drop scenarios to verify visual, audible, and haptic warnings during high-altitude antenna rigging.
          </p>

          {/* Manual Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span>Manual Battery Level: <strong className="text-white">{batteryState.level}%</strong></span>
              <span className="text-purple-300">Drag to trigger threshold alarms</span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              value={batteryState.level}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                deviceBatteryService.setSimulatedLevel(val, batteryState.charging);
              }}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
          </div>

          {/* Presets Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs font-mono">
            <button
              onClick={() => deviceBatteryService.setSimulatedLevel(92, false, -11.0)}
              className="p-2 rounded bg-slate-900 border border-slate-800 hover:border-emerald-600 text-emerald-400 text-left"
            >
              <div className="font-bold">Nominal (92%)</div>
              <div className="text-[10px] text-slate-500">Normal operations</div>
            </button>
            <button
              onClick={() => deviceBatteryService.setSimulatedLevel(24, false, -18.5)}
              className="p-2 rounded bg-slate-900 border border-slate-800 hover:border-amber-600 text-amber-400 text-left"
            >
              <div className="font-bold">Advisory (24%)</div>
              <div className="text-[10px] text-slate-500">Below 25% warning</div>
            </button>
            <button
              onClick={() => deviceBatteryService.setSimulatedLevel(14, false, -24.0)}
              className="p-2 rounded bg-slate-900 border border-slate-800 hover:border-orange-600 text-orange-400 text-left"
            >
              <div className="font-bold">Critical (14%)</div>
              <div className="text-[10px] text-slate-500">Tower descent call</div>
            </button>
            <button
              onClick={() => deviceBatteryService.setSimulatedLevel(5, false, -32.0)}
              className="p-2 rounded bg-slate-900 border border-slate-800 hover:border-rose-600 text-rose-400 text-left"
            >
              <div className="font-bold">Emergency (5%)</div>
              <div className="text-[10px] text-slate-500">Siren + Auto Flush</div>
            </button>
            <button
              onClick={() => deviceBatteryService.setSimulatedLevel(batteryState.level, !batteryState.charging, 25.0)}
              className="p-2 rounded bg-slate-900 border border-slate-800 hover:border-cyan-600 text-cyan-400 text-left col-span-2 sm:col-span-4 flex items-center justify-between"
            >
              <span className="font-bold">Toggle Power Bank Connection ({batteryState.charging ? 'Disconnect' : 'Connect Charger'})</span>
              <Zap className="w-4 h-4 text-cyan-400" />
            </button>
          </div>
        </div>
      )}

      {/* Telemetry Chart: Rolling Discharge Curve */}
      <div
        className={`p-4 rounded-xl border space-y-3 ${
          sunlightMode ? 'bg-amber-50 border-amber-300' : 'bg-slate-950 border-slate-800'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Tower Handheld Battery Discharge Curve (Last 60 Minutes)</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Multi-sample rolling discharge tracking with critical safety descent thresholds.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Battery %
            </span>
            <span className="flex items-center gap-1 text-rose-400">
              <span className="w-2.5 h-0.5 bg-rose-500" /> Critical (15%)
            </span>
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-2.5 h-0.5 bg-amber-500" /> Warning (25%)
            </span>
          </div>
        </div>

        {/* Recharts Area Chart */}
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="batteryLevelGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
              <XAxis dataKey="timeStr" stroke="#64748b" tick={{ fontSize: 11, fontFamily: 'monospace' }} />
              <YAxis domain={[0, 100]} stroke="#64748b" tick={{ fontSize: 11, fontFamily: 'monospace' }} unit="%" />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const data = payload[0].payload as DeviceBatteryLogPoint;
                  return (
                    <div className="p-2.5 rounded bg-slate-950/95 border border-slate-700 text-xs font-mono space-y-1 shadow-2xl">
                      <div className="font-bold text-white border-b border-slate-800 pb-1">
                        Time: {label}
                      </div>
                      <div className="text-cyan-400">Battery Level: {data.level}%</div>
                      <div className="text-slate-300">
                        Discharge Rate: {data.dischargeRatePerHour}%/hr
                      </div>
                      <div className="text-slate-400">Temp: {data.temperatureC}°C</div>
                      <div className="text-amber-400 font-bold">Status: {data.alertLevel}</div>
                    </div>
                  );
                }}
              />
              <ReferenceLine y={batteryState.criticalThreshold} stroke="#ef4444" strokeDasharray="3 3" />
              <ReferenceLine y={batteryState.warningThreshold} stroke="#f59e0b" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="level"
                stroke="#06b6d4"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#batteryLevelGrad)"
                name="Battery %"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Threshold Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md p-5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Sliders className="w-5 h-5 text-cyan-400" />
                <span>Configure Tower Battery Thresholds</span>
              </h3>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div className="space-y-1.5">
                <label className="flex justify-between">
                  <span>Advisory Warning Threshold:</span>
                  <strong className="text-amber-400">{tempWarning}%</strong>
                </label>
                <input
                  type="range"
                  min="20"
                  max="40"
                  value={tempWarning}
                  onChange={(e) => setTempWarning(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-slate-800 rounded accent-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="flex justify-between">
                  <span>Critical Descent Threshold:</span>
                  <strong className="text-orange-400">{tempCritical}%</strong>
                </label>
                <input
                  type="range"
                  min="10"
                  max="20"
                  value={tempCritical}
                  onChange={(e) => setTempCritical(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-slate-800 rounded accent-orange-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="flex justify-between">
                  <span>Emergency Rigging Cutoff:</span>
                  <strong className="text-rose-400">{tempEmergency}%</strong>
                </label>
                <input
                  type="range"
                  min="3"
                  max="10"
                  value={tempEmergency}
                  onChange={(e) => setTempEmergency(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-slate-800 rounded accent-rose-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowConfigModal(false)}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveThresholds}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold font-mono"
              >
                Save Thresholds
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
