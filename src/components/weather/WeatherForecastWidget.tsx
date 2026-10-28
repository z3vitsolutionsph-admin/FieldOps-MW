import React, { useState, useEffect } from 'react';
import {
  Wind,
  Eye,
  EyeOff,
  CloudRain,
  CloudLightning,
  Sun,
  Cloud,
  Compass,
  MapPin,
  Navigation,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Sliders,
  Clock,
  Gauge,
  Thermometer,
  Droplets,
  Zap,
} from 'lucide-react';
import {
  weatherService,
  WeatherSafetyReport,
  WeatherSimulationMode,
  HourlyWeatherForecast,
} from '../../services/weatherService';

interface WeatherForecastWidgetProps {
  compact?: boolean;
  sunlightMode?: boolean;
  onSafetyStatusChange?: (isSafe: boolean, report: WeatherSafetyReport) => void;
  siteCoords?: { lat: number; lon: number; name: string };
}

export const WeatherForecastWidget: React.FC<WeatherForecastWidgetProps> = ({
  compact = false,
  sunlightMode = false,
  onSafetyStatusChange,
  siteCoords = { lat: 9.8712, lon: 126.1583, name: 'Site A: Catangnan MW Hub' },
}) => {
  const [report, setReport] = useState<WeatherSafetyReport | null>(() =>
    weatherService.getCachedReport()
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeLocationType, setActiveLocationType] = useState<'USER_GPS' | 'SITE_COORDS'>('USER_GPS');
  const [showSimControls, setShowSimControls] = useState<boolean>(false);
  const [simMode, setSimMode] = useState<WeatherSimulationMode>(() =>
    weatherService.getSimulationMode()
  );
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Load weather on mount or when location type / siteCoords changes
  const loadWeatherData = async (forceLocationType?: 'USER_GPS' | 'SITE_COORDS') => {
    setIsLoading(true);
    setGpsError(null);
    const locType = forceLocationType || activeLocationType;

    try {
      if (locType === 'USER_GPS') {
        const userLoc = await weatherService.getUserLocation();
        if (!userLoc.isRealGps) {
          setGpsError('GPS permission not granted; fell back to default site coordinates.');
        }
        const rep = await weatherService.fetchSiteWeather(
          userLoc.lat,
          userLoc.lon,
          userLoc.label,
          userLoc.isRealGps
        );
        setReport(rep);
        if (onSafetyStatusChange) {
          onSafetyStatusChange(rep.isSafeForTowerWork, rep);
        }
      } else {
        const rep = await weatherService.fetchSiteWeather(
          siteCoords.lat,
          siteCoords.lon,
          siteCoords.name,
          false
        );
        setReport(rep);
        if (onSafetyStatusChange) {
          onSafetyStatusChange(rep.isSafeForTowerWork, rep);
        }
      }
    } catch (err: any) {
      console.warn('Weather fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWeatherData();
    const unsubscribe = weatherService.subscribe((newReport) => {
      setReport(newReport);
      if (onSafetyStatusChange) {
        onSafetyStatusChange(newReport.isSafeForTowerWork, newReport);
      }
    });
    return () => unsubscribe();
  }, [activeLocationType, siteCoords.lat, siteCoords.lon]);

  const handleSwitchToGps = () => {
    setActiveLocationType('USER_GPS');
    loadWeatherData('USER_GPS');
  };

  const handleSwitchToSite = () => {
    setActiveLocationType('SITE_COORDS');
    loadWeatherData('SITE_COORDS');
  };

  const handleSimModeChange = (mode: WeatherSimulationMode) => {
    setSimMode(mode);
    weatherService.setSimulationMode(mode);
    loadWeatherData();
  };

  if (!report && isLoading) {
    return (
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs font-mono text-slate-400 flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
        <span>Acquiring localized weather telemetry...</span>
      </div>
    );
  }

  const currentReport = report || {
    temperatureC: 28.5,
    windSpeedKmh: 16.2,
    windGustKmh: 21.5,
    windTowerHeightKmh: 21.4,
    windDirectionDeg: 75,
    windDirectionCardinal: 'ENE',
    visibilityKm: 10.0,
    visibilityStatus: 'EXCELLENT' as const,
    weatherCode: 2,
    weatherCondition: 'Partly Cloudy',
    relativeHumidity: 75,
    lightningDetectedWithin10Km: false,
    nearestLightningDistanceKm: 42.0,
    isSafeForTowerWork: true,
    violations: [],
    timestamp: new Date().toISOString(),
    source: 'OFFLINE_CACHE' as const,
    siteLat: siteCoords.lat,
    siteLong: siteCoords.lon,
    locationLabel: siteCoords.name,
    isUserLocation: false,
  };

  // Status Styling Logic
  const isHighWind = currentReport.windSpeedKmh > 30.0;
  const isCautionWind = currentReport.windSpeedKmh > 24.0 && !isHighWind;
  const isLowVisibility = currentReport.visibilityKm < 4.0;
  const isCautionVisibility = currentReport.visibilityKm < 7.0 && !isLowVisibility;
  const isSafe = currentReport.isSafeForTowerWork;

  // Render weather icon based on WMO code
  const renderWeatherIcon = (code: number, className = 'w-5 h-5') => {
    if (code === 0 || code === 1) return <Sun className={`${className} text-amber-400`} />;
    if (code === 2 || code === 3) return <Cloud className={`${className} text-slate-300`} />;
    if (code === 45 || code === 48) return <EyeOff className={`${className} text-slate-400`} />;
    if (code >= 51 && code <= 82) return <CloudRain className={`${className} text-cyan-400`} />;
    if (code >= 95) return <CloudLightning className={`${className} text-rose-500 animate-pulse`} />;
    return <Cloud className={`${className} text-slate-300`} />;
  };

  // COMPACT MODE: Designed specifically for PreClimbSafetyModal & embedded checklist cards
  if (compact) {
    return (
      <div
        className={`p-3.5 rounded-xl border transition-all ${
          sunlightMode
            ? isSafe
              ? 'bg-amber-100 border-amber-400 text-neutral-900'
              : 'bg-rose-100 border-rose-500 text-neutral-900'
            : isSafe
            ? 'bg-slate-900/90 border-slate-800 text-slate-100'
            : 'bg-rose-950/40 border-rose-600/80 text-rose-200'
        }`}
      >
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <div
              className={`p-1.5 rounded-lg border ${
                isSafe
                  ? 'bg-emerald-950/80 border-emerald-700/80 text-emerald-400'
                  : 'bg-rose-950/80 border-rose-600 text-rose-400'
              }`}
            >
              {isSafe ? <CheckCircle2 className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4 animate-bounce" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-mono uppercase tracking-wider">
                  {isSafe ? 'TOWER WEATHER: SAFE TO CLIMB' : 'CLIMBING HOLD: HAZARD DETECTED'}
                </span>
                <span
                  className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded border ${
                    currentReport.isUserLocation
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  {currentReport.isUserLocation ? 'GPS LOCKED' : 'SITE COORDS'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono truncate max-w-xs sm:max-w-md">
                {currentReport.locationLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => loadWeatherData()}
              disabled={isLoading}
              title="Refresh live localized weather"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Primary Wind & Visibility Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2.5">
          {/* Wind Speed at 10m */}
          <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/90 font-mono">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-0.5">
              <span className="flex items-center gap-1">
                <Wind className="w-3 h-3 text-cyan-400" /> Ground Wind
              </span>
              <span className="text-xs">Max 30</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span
                className={`text-base font-bold ${
                  isHighWind ? 'text-rose-400' : isCautionWind ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {currentReport.windSpeedKmh}
              </span>
              <span className="text-xs text-slate-400">km/h</span>
              <span className="text-xs text-slate-400 ml-auto">{currentReport.windDirectionCardinal}</span>
            </div>
          </div>

          {/* Tower Top Wind at 45m */}
          <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/90 font-mono">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-0.5">
              <span className="flex items-center gap-1">
                <Gauge className="w-3 h-3 text-cyan-400" /> Tower 45m
              </span>
              <span className="text-xs">Shear 1.3x</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span
                className={`text-base font-bold ${
                  currentReport.windTowerHeightKmh > 38.0
                    ? 'text-rose-400'
                    : currentReport.windTowerHeightKmh > 30.0
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {currentReport.windTowerHeightKmh}
              </span>
              <span className="text-xs text-slate-400">km/h</span>
              <span className="text-xs text-slate-400 ml-auto">Gust {currentReport.windGustKmh}</span>
            </div>
          </div>

          {/* Line of Sight Visibility */}
          <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/90 font-mono">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-0.5">
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3 text-cyan-400" /> Visibility
              </span>
              <span className="text-xs">Min 4.0</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span
                className={`text-base font-bold ${
                  isLowVisibility ? 'text-rose-400' : isCautionVisibility ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {currentReport.visibilityKm}
              </span>
              <span className="text-xs text-slate-400">km</span>
              <span
                className={`text-xs ml-auto font-bold ${
                  currentReport.visibilityStatus === 'EXCELLENT'
                    ? 'text-emerald-400'
                    : currentReport.visibilityStatus === 'GOOD'
                    ? 'text-cyan-400'
                    : currentReport.visibilityStatus === 'MODERATE'
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {currentReport.visibilityStatus}
              </span>
            </div>
          </div>

          {/* Condition & Lightning */}
          <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/90 font-mono">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-0.5">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-cyan-400" /> Lightning
              </span>
              <span className="text-xs">10km Gate</span>
            </div>
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-bold ${
                  currentReport.lightningDetectedWithin10Km ? 'text-rose-400 animate-pulse' : 'text-emerald-400'
                }`}
              >
                {currentReport.lightningDetectedWithin10Km
                  ? `STRIKE ${currentReport.nearestLightningDistanceKm}km`
                  : 'CLEAR (>10km)'}
              </span>
              <span className="text-xs text-slate-300">{currentReport.temperatureC}°C</span>
            </div>
          </div>
        </div>

        {/* Violations Warning Bar (if unsafe) */}
        {!isSafe && currentReport.violations.length > 0 && (
          <div className="mt-2.5 p-2 rounded-lg bg-rose-950/80 border border-rose-600 text-xs font-mono text-rose-200 space-y-1">
            <div className="font-bold flex items-center gap-1 text-rose-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Tower Work Clearance Restrained:</span>
            </div>
            {currentReport.violations.map((v, i) => (
              <p key={i} className="pl-4 text-xs opacity-90">
                • {v}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  // FULL MODE: High-density interactive weather forecasting dashboard for Dashboard.tsx
  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-xl ${
        sunlightMode
          ? 'bg-amber-50/90 border-amber-300 text-neutral-900 shadow-amber-950/10'
          : 'bg-slate-900/90 border-slate-800 text-slate-100 shadow-black/60'
      }`}
    >
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-start sm:items-center gap-3">
          <div
            className={`p-2.5 rounded-xl border flex items-center justify-center shrink-0 ${
              isSafe
                ? 'bg-emerald-950/80 border-emerald-700/80 text-emerald-400 shadow-sm'
                : 'bg-rose-950/90 border-rose-600 text-rose-400 animate-pulse'
            }`}
          >
            {renderWeatherIcon(currentReport.weatherCode, 'w-6 h-6')}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-sm sm:text-base uppercase tracking-tight">
                Localized Tower Weather & Environmental Telemetry
              </h3>
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                  isSafe
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                    : 'bg-rose-950 text-rose-300 border-rose-600 animate-pulse'
                }`}
              >
                {isSafe ? 'SAFE FOR TOWER WORK' : 'NO-CLIMB HOLD (WEATHER)'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5 flex-wrap">
              <span className="flex items-center gap-1 text-slate-300">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                {currentReport.locationLabel}
              </span>
              <span>·</span>
              <span>{currentReport.weatherCondition}</span>
              <span>·</span>
              <span className="text-xs text-slate-400">
                Updated {new Date(currentReport.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        {/* Location Controls & Simulator Toggle */}
        <div className="flex items-center gap-1.5 flex-wrap self-end sm:self-auto">
          {/* Location Mode Switchers */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
            <button
              onClick={handleSwitchToGps}
              className={`px-2 py-1 rounded-md transition-colors flex items-center gap-1 ${
                activeLocationType === 'USER_GPS'
                  ? 'bg-cyan-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Detect current device GPS coordinates"
            >
              <Navigation className="w-3 h-3" />
              <span>My Location</span>
            </button>
            <button
              onClick={handleSwitchToSite}
              className={`px-2 py-1 rounded-md transition-colors flex items-center gap-1 ${
                activeLocationType === 'SITE_COORDS'
                  ? 'bg-cyan-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Use Site A (Catangnan) coordinates"
            >
              <Compass className="w-3 h-3" />
              <span>Site A</span>
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => loadWeatherData()}
            disabled={isLoading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
            title="Refresh weather data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          {/* Simulator Toggle */}
          <button
            onClick={() => setShowSimControls(!showSimControls)}
            className={`px-2 py-1 rounded-lg border text-xs font-mono transition-colors flex items-center gap-1 ${
              showSimControls
                ? 'bg-purple-950 text-purple-300 border-purple-600 font-bold'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
            title="Toggle EHS Weather Simulation Modes"
          >
            <Sliders className="w-3 h-3" />
            <span className="hidden md:inline">Simulate</span>
          </button>
        </div>
      </div>

      {gpsError && (
        <div className="mt-2.5 p-2 rounded bg-amber-950/60 border border-amber-700 text-xs font-mono text-amber-300 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{gpsError}</span>
        </div>
      )}

      {/* Simulator Controls Strip (collapsible) */}
      {showSimControls && (
        <div className="mt-3 p-3 rounded-xl bg-purple-950/40 border border-purple-800/80 text-xs font-mono space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between text-purple-300">
            <span className="font-bold flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              EHS Weather Safety Simulation Sandbox:
            </span>
            <span className="text-xs text-purple-400">Telecom Tower Compliance Testing</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            {[
              { id: 'LIVE', label: 'Live Open-Meteo', desc: 'Real GPS' },
              { id: 'CALM_SAFE', label: 'Calm & Clear', desc: '13.8 km/h · 16km vis' },
              { id: 'HIGH_WIND', label: 'High Wind Alert', desc: '37.4 km/h (>30 Limit)' },
              { id: 'LIGHTNING', label: 'Lightning 4.8km', desc: '<10km Exclusion' },
              { id: 'SEVERE_COMBO', label: 'Severe Squall', desc: '44km/h · 2.1km vis' },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => handleSimModeChange(s.id as WeatherSimulationMode)}
                className={`p-2 rounded-lg border text-left transition-all ${
                  simMode === s.id
                    ? 'bg-purple-600 text-white border-purple-400 shadow-md font-bold'
                    : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-purple-700'
                }`}
              >
                <div className="text-xs font-bold">{s.label}</div>
                <div className="text-xs opacity-75">{s.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Primary Telemetry Cards Grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
        {/* Wind Speed (Ground & 45m Tower Top) */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1.5">
              <Wind className="w-4 h-4 text-cyan-400" />
              Wind Speed
            </span>
            <span className="text-xs text-slate-400 font-bold">OSHA Max: 30</span>
          </div>

          <div className="flex items-baseline gap-1.5 pt-1">
            <span
              className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                isHighWind ? 'text-rose-400' : isCautionWind ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {currentReport.windSpeedKmh}
            </span>
            <span className="text-xs font-mono text-slate-400">km/h</span>
            <span className="text-xs font-mono text-slate-400 ml-auto font-semibold">
              {(currentReport.windSpeedKmh * 0.539957).toFixed(1)} kts
            </span>
          </div>

          <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Tower 45m Mast:</span>
            <span
              className={`font-bold ${
                currentReport.windTowerHeightKmh > 36.0
                  ? 'text-rose-400'
                  : currentReport.windTowerHeightKmh > 30.0
                  ? 'text-amber-400'
                  : 'text-slate-200'
              }`}
            >
              {currentReport.windTowerHeightKmh} km/h
            </span>
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Peak Gusts / Heading:</span>
            <span className="text-slate-300 font-semibold">
              {currentReport.windGustKmh} km/h · {currentReport.windDirectionCardinal} ({currentReport.windDirectionDeg}°)
            </span>
          </div>
        </div>

        {/* Line of Sight Visibility */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-cyan-400" />
              Optical Visibility
            </span>
            <span className="text-xs text-slate-400 font-bold">Min: 4.0 km</span>
          </div>

          <div className="flex items-baseline gap-1.5 pt-1">
            <span
              className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                isLowVisibility ? 'text-rose-400' : isCautionVisibility ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {currentReport.visibilityKm}
            </span>
            <span className="text-xs font-mono text-slate-400">km</span>
            <span className="text-xs font-mono text-slate-400 ml-auto font-semibold">
              {(currentReport.visibilityKm * 0.621371).toFixed(1)} mi
            </span>
          </div>

          <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">Optical Status:</span>
            <span
              className={`font-bold ${
                currentReport.visibilityStatus === 'EXCELLENT'
                  ? 'text-emerald-400'
                  : currentReport.visibilityStatus === 'GOOD'
                  ? 'text-cyan-400'
                  : currentReport.visibilityStatus === 'MODERATE'
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {currentReport.visibilityStatus}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Hop Path Clear:</span>
            <span className="text-slate-300 font-semibold">
              {currentReport.visibilityKm >= 7.42 ? 'Full 7.42km Hop Clear' : 'Path Partially Obscured'}
            </span>
          </div>
        </div>

        {/* Lightning & Thunderstorm Perimeter */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-cyan-400" />
              Lightning Radius
            </span>
            <span className="text-xs text-slate-400 font-bold">10 km Gate</span>
          </div>

          <div className="flex items-baseline gap-1.5 pt-1">
            <span
              className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                currentReport.lightningDetectedWithin10Km ? 'text-rose-400 animate-pulse' : 'text-emerald-400'
              }`}
            >
              {currentReport.lightningDetectedWithin10Km
                ? `${currentReport.nearestLightningDistanceKm} km`
                : '>10 km'}
            </span>
            <span className="text-xs font-mono text-slate-400">
              {currentReport.lightningDetectedWithin10Km ? 'ALERT' : 'Clear'}
            </span>
          </div>

          <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Electrocution Risk:</span>
            <span
              className={`font-bold ${
                currentReport.lightningDetectedWithin10Km ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {currentReport.lightningDetectedWithin10Km ? 'SEVERE / ACTIVE' : 'NOMINAL / ZERO'}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Safe Ascent Zone:</span>
            <span className="text-slate-300 font-semibold">
              {currentReport.lightningDetectedWithin10Km ? 'Ascent Prohibited' : 'Perimeter Safe'}
            </span>
          </div>
        </div>

        {/* Ambient Temperature & Relative Humidity */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-cyan-400" />
              Ambient / Humidity
            </span>
            <span className="text-xs text-slate-400 font-bold">Heat Index</span>
          </div>

          <div className="flex items-baseline gap-1.5 pt-1">
            <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-100">
              {currentReport.temperatureC}°C
            </span>
            <span className="text-xs font-mono text-slate-400">
              ({(currentReport.temperatureC * 1.8 + 32).toFixed(1)}°F)
            </span>
            <span className="text-xs font-mono text-cyan-400 ml-auto font-semibold">
              {currentReport.relativeHumidity}% RH
            </span>
          </div>

          <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Rigger Hydration:</span>
            <span className="text-slate-200 font-bold">
              {currentReport.temperatureC > 32 ? 'High Heat (Mandatory Rest)' : 'Normal Hydration'}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Data Source:</span>
            <span className="text-cyan-400 font-semibold">{currentReport.source}</span>
          </div>
        </div>
      </div>

      {/* Safety Violations Callout if Tower Work is Restricted */}
      {!isSafe && currentReport.violations.length > 0 && (
        <div className="mt-3.5 p-3 rounded-xl bg-rose-950/90 border border-rose-600 text-rose-200 text-xs font-mono space-y-1.5 shadow-lg shadow-rose-950/50">
          <div className="flex items-center gap-2 font-bold text-rose-300">
            <ShieldAlert className="w-4 h-4 animate-bounce" />
            <span>MANDATORY EHS SAFETY HOLD — CONDITIONS EXCEED OPERATIONAL ENVELOPE:</span>
          </div>
          <div className="space-y-1 pl-6 text-xs">
            {currentReport.violations.map((v, idx) => (
              <p key={idx}>• {v}</p>
            ))}
          </div>
        </div>
      )}

      {/* 6-Hour Climbing Window Forecast Strip */}
      {currentReport.hourlyForecast && currentReport.hourlyForecast.length > 0 && (
        <div className="mt-4 pt-3.5 border-t border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-bold text-slate-300 uppercase flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              Next 6-Hour Tower Climbing Window Forecast
            </span>
            <span className="text-xs font-mono text-slate-400">
              Thresholds: Wind ≤ 30 km/h · Vis ≥ 4.0 km
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {currentReport.hourlyForecast.map((h, i) => (
              <div
                key={i}
                className={`p-2 rounded-xl border text-center font-mono transition-all ${
                  h.isSafe
                    ? 'bg-slate-950/70 border-slate-800/90 text-slate-200'
                    : 'bg-rose-950/40 border-rose-700/70 text-rose-200'
                }`}
              >
                <div className="text-xs font-bold text-slate-400">{h.timeStr}</div>
                <div className="my-1 flex items-center justify-center">
                  {renderWeatherIcon(h.weatherCode, 'w-5 h-5')}
                </div>
                <div className="text-xs font-bold">{h.tempC}°C</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Wind: <strong className={h.windSpeedKmh > 30 ? 'text-rose-400' : 'text-slate-200'}>{h.windSpeedKmh}</strong> km/h
                </div>
                <div className="text-xs text-slate-400">
                  Vis: <strong className={h.visibilityKm < 4 ? 'text-rose-400' : 'text-slate-200'}>{h.visibilityKm}</strong> km
                </div>
                <div className="mt-1">
                  <span
                    className={`text-xs font-bold px-1.5 py-0.5 rounded border ${
                      h.isSafe
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                        : 'bg-rose-950 text-rose-300 border-rose-600'
                    }`}
                  >
                    {h.isSafe ? 'CLIMB SAFE' : 'HOLD'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
