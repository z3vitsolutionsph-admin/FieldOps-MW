import React, { useState } from 'react';
import {
  Wind,
  CloudLightning,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  Info,
  Sliders,
  X,
  Lock,
} from 'lucide-react';
import {
  WeatherSafetyReport,
  WeatherSimulationMode,
  weatherService,
} from '../../services/weatherService';
import { UserProfile } from '../../types/fieldops';

interface WeatherSafetyWidgetProps {
  report: WeatherSafetyReport | null;
  isLoading: boolean;
  onRefresh: () => void;
  activeUser: UserProfile;
  siteName: string;
  onClearanceUpdated: () => void;
  sunlightMode?: boolean;
}

export const WeatherSafetyWidget: React.FC<WeatherSafetyWidgetProps> = ({
  report,
  isLoading,
  onRefresh,
  activeUser,
  siteName,
  onClearanceUpdated,
  sunlightMode,
}) => {
  const [showSimMenu, setShowSimMenu] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overridePin, setOverridePin] = useState('');
  const [overrideReason, setOverrideReason] = useState(
    'Calibrated on-site anemometer reads 21 km/h. Local squall moved offshore east; verified safe by Site Safety Supervisor.'
  );
  const [overrideError, setOverrideError] = useState<string | null>(null);

  if (!report) {
    return (
      <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
          <span>Fetching local microclimate telemetry from site coordinates...</span>
        </div>
      </div>
    );
  }

  const isWindViolated = report.windSpeedKmh > 30.0;
  const isLightningViolated = report.lightningDetectedWithin10Km;
  const hasActiveHazard = isWindViolated || isLightningViolated;
  const isCleared = report.isSafeForTowerWork;
  const hasEhsClearance = Boolean(report.clearedByOfficer);

  const handleSimSelect = async (mode: WeatherSimulationMode) => {
    weatherService.setSimulationMode(mode);
    setShowSimMenu(false);
    await weatherService.fetchSiteWeather(report.siteLat, report.siteLong, mode);
    onClearanceUpdated();
  };

  const handleSignOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!overridePin || overridePin.trim().length < 4) {
      setOverrideError('Please enter a valid 4-digit Supervisor/EHS PIN.');
      return;
    }
    if (!overrideReason.trim()) {
      setOverrideError('Detailed EHS rationale and ground verification note required.');
      return;
    }

    weatherService.clearHazardWithAuthorization(
      activeUser.name || 'Safety Supervisor',
      overridePin,
      overrideReason
    );
    setShowOverrideModal(false);
    setOverridePin('');
    setOverrideError(null);
    onClearanceUpdated();
  };

  const handleResetClearance = () => {
    weatherService.resetClearance();
    onClearanceUpdated();
  };

  return (
    <div
      className={`rounded-xl border transition-all duration-300 overflow-hidden ${
        hasActiveHazard && !hasEhsClearance
          ? 'bg-rose-950/30 border-rose-600/80 shadow-lg shadow-rose-950/40 ring-1 ring-rose-500/50'
          : hasEhsClearance
          ? 'bg-amber-950/30 border-amber-500/80 shadow-md ring-1 ring-amber-500/40'
          : 'bg-slate-900/90 border-slate-800 text-slate-100'
      }`}
    >
      {/* Top Banner Bar */}
      <div
        className={`px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b ${
          hasActiveHazard && !hasEhsClearance
            ? 'bg-rose-900/60 border-rose-800 text-white'
            : hasEhsClearance
            ? 'bg-amber-900/40 border-amber-800 text-amber-200'
            : 'bg-slate-950/80 border-slate-800 text-slate-300'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {hasActiveHazard && !hasEhsClearance ? (
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
          ) : hasEhsClearance ? (
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}

          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-black uppercase tracking-wider font-mono px-2 py-0.5 rounded ${
                  hasActiveHazard && !hasEhsClearance
                    ? 'bg-rose-600 text-white animate-pulse'
                    : hasEhsClearance
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                    : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                }`}
              >
                {hasActiveHazard && !hasEhsClearance
                  ? '⛔ TOWER WORK SUSPENDED — WEATHER HAZARD'
                  : hasEhsClearance
                  ? '🛡 EHS VARIANCE CLEARANCE ACTIVE'
                  : '✓ ATMOSPHERIC SAFETY CLEAR'}
              </span>

              <span className="text-[11px] hidden sm:inline text-slate-300">
                {hasActiveHazard && !hasEhsClearance
                  ? 'Climbing blocked per 30 km/h wind / 10 km lightning limits'
                  : hasEhsClearance
                  ? `Authorized by ${report.clearedByOfficer?.officerName}`
                  : 'Safe for tower ascent and antenna rigging'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Action buttons */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Simulation mode quick dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSimMenu(!showSimMenu)}
              className="px-2.5 py-1 text-[11px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 flex items-center gap-1"
              title="Test & Simulate weather hazard scenarios"
            >
              <Sliders className="w-3 h-3 text-cyan-400" />
              <span className="hidden md:inline">Mode:</span>
              <span className="font-bold uppercase text-[10px]">
                {weatherService.getSimulationMode()}
              </span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showSimMenu && (
              <div className="absolute right-0 mt-1 w-56 rounded-lg bg-slate-900 border border-slate-700 shadow-2xl py-1 z-30 text-xs">
                <div className="px-3 py-1 text-[10px] font-mono text-slate-400 border-b border-slate-800 uppercase">
                  Safety Alert Test Modes
                </div>
                <button
                  type="button"
                  onClick={() => handleSimSelect('LIVE')}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-slate-200 flex items-center justify-between"
                >
                  <span>🌐 Live Local Weather (API)</span>
                  {weatherService.getSimulationMode() === 'LIVE' && (
                    <span className="text-cyan-400 text-[10px]">✓</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleSimSelect('HIGH_WIND')}
                  className="w-full text-left px-3 py-1.5 hover:bg-rose-950/60 text-rose-300 flex items-center justify-between"
                >
                  <span>💨 High Wind (36.8 km/h &gt; 30)</span>
                  {weatherService.getSimulationMode() === 'HIGH_WIND' && (
                    <span className="text-rose-400 text-[10px]">✓</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleSimSelect('LIGHTNING')}
                  className="w-full text-left px-3 py-1.5 hover:bg-rose-950/60 text-amber-300 flex items-center justify-between"
                >
                  <span>⚡ Lightning Cell (5.4 km &lt; 10)</span>
                  {weatherService.getSimulationMode() === 'LIGHTNING' && (
                    <span className="text-amber-400 text-[10px]">✓</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleSimSelect('SEVERE_COMBO')}
                  className="w-full text-left px-3 py-1.5 hover:bg-rose-950/60 text-rose-400 flex items-center justify-between"
                >
                  <span>⛈ Severe Squall (Wind + Strike)</span>
                  {weatherService.getSimulationMode() === 'SEVERE_COMBO' && (
                    <span className="text-rose-400 text-[10px]">✓</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleSimSelect('CALM_SAFE')}
                  className="w-full text-left px-3 py-1.5 hover:bg-emerald-950/60 text-emerald-300 flex items-center justify-between"
                >
                  <span>☀️ Calm Weather (14.2 km/h)</span>
                  {weatherService.getSimulationMode() === 'CALM_SAFE' && (
                    <span className="text-emerald-400 text-[10px]">✓</span>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Refresh button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 disabled:opacity-50"
            title="Re-check live weather"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Telemetry Grid */}
      <div className="p-3.5 sm:p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Metric 1: Wind Speed (OSHA Max: 30 km/h) */}
          <div
            className={`p-2.5 rounded-lg border flex flex-col justify-between ${
              isWindViolated
                ? 'bg-rose-950/50 border-rose-600 text-rose-200'
                : report.windSpeedKmh > 24
                ? 'bg-amber-950/40 border-amber-600 text-amber-200'
                : 'bg-slate-950/70 border-slate-800 text-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold opacity-80 flex items-center gap-1">
                <Wind className="w-3 h-3 text-cyan-400" />
                Wind Speed
              </span>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold ${
                  isWindViolated
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                Limit: 30 km/h
              </span>
            </div>

            <div className="mt-1 flex items-baseline gap-1.5">
              <span
                className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${
                  isWindViolated
                    ? 'text-rose-400'
                    : report.windSpeedKmh > 24
                    ? 'text-amber-300'
                    : 'text-cyan-300'
                }`}
              >
                {report.windSpeedKmh}
              </span>
              <span className="text-xs font-semibold opacity-75">km/h</span>
            </div>

            {/* Visual meter bar */}
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
              <div
                className={`h-full transition-all duration-500 ${
                  isWindViolated
                    ? 'bg-rose-500'
                    : report.windSpeedKmh > 24
                    ? 'bg-amber-400'
                    : 'bg-cyan-500'
                }`}
                style={{ width: `${Math.min(100, (report.windSpeedKmh / 40) * 100)}%` }}
              />
            </div>

            <p className="text-[10px] opacity-75 mt-1 font-mono">
              Gusts: {report.windGustKmh} km/h
            </p>
          </div>

          {/* Metric 2: Lightning Activity (10 km perimeter) */}
          <div
            className={`p-2.5 rounded-lg border flex flex-col justify-between ${
              isLightningViolated
                ? 'bg-rose-950/50 border-rose-600 text-rose-200'
                : 'bg-slate-950/70 border-slate-800 text-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold opacity-80 flex items-center gap-1">
                <CloudLightning className="w-3 h-3 text-amber-400" />
                Lightning
              </span>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold ${
                  isLightningViolated
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                Limit: 10 km
              </span>
            </div>

            <div className="mt-1 flex items-baseline gap-1.5">
              <span
                className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${
                  isLightningViolated ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {report.nearestLightningDistanceKm !== null
                  ? `${report.nearestLightningDistanceKm} km`
                  : '&gt; 50 km'}
              </span>
            </div>

            {/* Radar status indicator */}
            <div className="mt-1.5 flex items-center gap-1 text-[10px] font-mono">
              {isLightningViolated ? (
                <span className="text-rose-300 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  STRIKE DETECTED IN ZONE
                </span>
              ) : (
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  No strikes within 10 km
                </span>
              )}
            </div>
            <p className="text-[10px] opacity-75 mt-0.5 font-mono">
              Perimeter: 10 km exclusion
            </p>
          </div>

          {/* Metric 3: Atmosphere / Weather Code */}
          <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/70 text-slate-200 flex flex-col justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold opacity-80 text-slate-400">
              Sky & Microclimate
            </span>
            <div className="mt-1">
              <p className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                {report.weatherCondition}
              </p>
              <p className="text-xs font-mono text-cyan-400 mt-0.5">
                {report.temperatureC}°C &bull; {report.relativeHumidity}% RH
              </p>
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-1">
              WMO Code #{report.weatherCode}
            </p>
          </div>

          {/* Metric 4: Geolocation Anchor */}
          <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/70 text-slate-200 flex flex-col justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold opacity-80 text-slate-400 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-rose-400" />
              Site Geolocation
            </span>
            <div className="mt-1">
              <p className="text-xs font-mono font-bold text-slate-200">
                {report.siteLat.toFixed(5)}° N
              </p>
              <p className="text-xs font-mono font-bold text-slate-200">
                {report.siteLong.toFixed(5)}° E
              </p>
            </div>
            <p className="text-[10px] text-slate-400 truncate mt-1">
              {siteName}
            </p>
          </div>
        </div>

        {/* Hazard Alert Box if Violations Exist */}
        {hasActiveHazard && (
          <div
            className={`p-3 rounded-lg border text-xs space-y-2 ${
              hasEhsClearance
                ? 'bg-amber-950/40 border-amber-600/80 text-amber-200'
                : 'bg-rose-950/70 border-rose-600 text-rose-100 shadow-inner'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <strong className="text-rose-300 font-bold uppercase tracking-wide">
                    Mandatory Tower Safety Violation Warning
                  </strong>
                  <span className="text-[10px] font-mono text-rose-400 bg-rose-950 px-2 py-0.5 rounded border border-rose-800">
                    DOLE-OSHA / TELCO RULE 1052
                  </span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-200/90 font-medium">
                  {report.violations.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              </div>
            </div>

            {hasEhsClearance && report.clearedByOfficer && (
              <div className="p-2.5 rounded bg-amber-900/40 border border-amber-700/80 text-[11px] space-y-1">
                <div className="flex items-center justify-between text-amber-300 font-bold">
                  <span>✓ Certified Ground Anemometer Clearance Issued</span>
                  <span className="font-mono text-[10px]">
                    {new Date(report.clearedByOfficer.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-amber-100/90 italic">
                  &quot;{report.clearedByOfficer.reason}&quot;
                </p>
                <div className="flex items-center justify-between text-[10px] text-amber-300/80 pt-1 border-t border-amber-800/60">
                  <span>Signatory: {report.clearedByOfficer.officerName}</span>
                  <button
                    type="button"
                    onClick={handleResetClearance}
                    className="underline text-amber-200 hover:text-white"
                  >
                    Revoke & Re-enforce Weather Lock
                  </button>
                </div>
              </div>
            )}

            {!hasEhsClearance && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-rose-800/60">
                <span className="text-[11px] text-rose-300 flex items-center gap-1.5 font-medium">
                  <Lock className="w-3.5 h-3.5" />
                  Tower ascent and antenna hoisting are locked until cleared.
                </span>
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  EHS Officer Ground Clearance
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* EHS Clearance Sign-off Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5 space-y-4 text-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-amber-400">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="font-bold text-sm text-white">
                  EHS Supervisor Weather Clearance
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              If local microclimate measurements (e.g. handheld calibrated anemometer or localized terrain shelter) confirm conditions have cleared below 30 km/h and lightning cells have dissipated, enter your Supervisor PIN and safety justification to clear the lock.
            </p>

            <form onSubmit={handleSignOverride} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Ground Measurement & Variance Justification
                </label>
                <textarea
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                  placeholder="Specify anemometer reading, microclimate verification, or storm cell direction..."
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Supervisor PIN Authorization
                </label>
                <input
                  type="password"
                  value={overridePin}
                  onChange={(e) => setOverridePin(e.target.value)}
                  placeholder="Enter 4-digit PIN (e.g. 8842)"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 font-mono text-sm text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              {overrideError && (
                <p className="text-xs text-rose-400 font-medium">{overrideError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center gap-1.5 shadow"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Sign Clearance & Unlock Tower
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
