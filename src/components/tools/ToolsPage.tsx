import React, { useState, useEffect } from 'react';
import {
  Zap,
  Radio,
  Compass,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  RotateCcw,
  Navigation2,
  Activity,
  BatteryCharging,
} from 'lucide-react';
import { Site, Hop } from '../../types/fieldops';
import { SensorAlignmentModal } from './SensorAlignmentModal';
import { AlignmentEngine } from './AlignmentEngine';
import { BatteryTelemetry } from './BatteryTelemetry';
import { storage } from '../../services/storageService';

interface ToolsPageProps {
  siteA: Site;
  siteB: Site;
  hop: Hop;
  sunlightMode: boolean;
}

export const ToolsPage: React.FC<ToolsPageProps> = ({
  siteA,
  siteB,
  hop,
  sunlightMode,
}) => {
  const [activeTool, setActiveTool] = useState<
    'POWER' | 'LINK_BUDGET' | 'COMPASS' | 'DMS_CONVERTER' | 'ALIGNMENT_ENGINE' | 'BATTERY_TELEMETRY'
  >('ALIGNMENT_ENGINE');
  const [showSensorModal, setShowSensorModal] = useState<boolean>(false);

  // 1. Power Sufficiency State (Pre-filled with Site B TSSR specs!)
  const [rectifierCount, setRectifierCount] = useState<number>(5);
  const [rectifierRatingA, setRectifierRatingA] = useState<number>(50);
  const [rectifierEnergized, setRectifierEnergized] = useState<boolean>(false); // Per Site B TSSR
  const [batteryAh, setBatteryAh] = useState<number>(100);
  const [batteryBanks, setBatteryBanks] = useState<number>(7);
  const [presentSiteLoadA, setPresentSiteLoadA] = useState<number>(38.5);

  // Added equipment toggles / counts
  const [nr9150Count, setNr9150Count] = useState<number>(1); // 120.84 W (2.26 A)
  const [er2020Count, setEr2020Count] = useState<number>(0); // 50.88 W (0.95 A)
  const [sru3dCount, setSru3dCount] = useState<number>(2); // 127.2 W (2.38 A)
  const [lossFactorPct, setLossFactorPct] = useState<number>(6); // 6%

  // 2. Link Budget State
  const [freqGhz, setFreqGhz] = useState<number>(11.0);
  const [distanceKm, setDistanceKm] = useState<number>(3.99);
  const [txPowerDbm, setTxPowerDbm] = useState<number>(20.0);
  const [txGainDbi, setTxGainDbi] = useState<number>(40.2);
  const [rxGainDbi, setRxGainDbi] = useState<number>(40.2);
  const [miscLossDb, setMiscLossDb] = useState<number>(2.3);

  // 3. Compass / Azimuth State
  const [magneticDeclination, setMagneticDeclination] = useState<number>(1.2); // Deg East
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);

  // 4. DMS Converter State
  const [inputLatDec, setInputLatDec] = useState<string>('9.80251');
  const [inputLongDec, setInputLongDec] = useState<string>('126.15602');
  const [dmsLatDeg, setDmsLatDeg] = useState<string>('9');
  const [dmsLatMin, setDmsLatMin] = useState<string>('48');
  const [dmsLatSec, setDmsLatSec] = useState<string>('9.04');
  const [dmsLatDir, setDmsLatDir] = useState<'N' | 'S'>('N');
  const [dmsLongDeg, setDmsLongDeg] = useState<string>('126');
  const [dmsLongMin, setDmsLongMin] = useState<string>('9');
  const [dmsLongSec, setDmsLongSec] = useState<string>('21.67');
  const [dmsLongDir, setDmsLongDir] = useState<'E' | 'W'>('E');

  // Device orientation API for live compass
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha !== null) {
        setDeviceHeading(Math.round(e.alpha));
      }
    };
    if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('deviceorientation', handleOrientation);
      }
    };
  }, []);

  // --- Calculations for Power Sufficiency ---
  const nominalVoltage = -48; // -48V
  const nr9150Watts = nr9150Count * 120.84;
  const er2020Watts = er2020Count * 50.88;
  const sru3dWatts = sru3dCount * 127.2;
  const totalEquipmentWatts = nr9150Watts + er2020Watts + sru3dWatts;
  const totalWattsWithLoss = totalEquipmentWatts * (1 + lossFactorPct / 100);
  const totalAddedCurrentA = totalWattsWithLoss / Math.abs(nominalVoltage);

  // Usable rectifier capacity: (N - 1) redundancy * rating * (1 - 0.10 battery recharge)
  const totalRectifierCapacityA = rectifierCount * rectifierRatingA;
  const nMinus1RedundantModules = Math.max(0, rectifierCount - 1);
  const usableRectifierCapacityA = nMinus1RedundantModules * rectifierRatingA * 0.9;
  const totalProjectedLoadA = presentSiteLoadA + totalAddedCurrentA;
  const capacitySurplusA = usableRectifierCapacityA - totalProjectedLoadA;

  // Battery backup hours: (Ah * Banks * 48V * 0.8 DoD) / Total Watts
  const totalBatteryAh = batteryAh * batteryBanks;
  const usableBatteryWattHours = totalBatteryAh * 48 * 0.8;
  const presentWatts = presentSiteLoadA * 48;
  const projectedWatts = totalProjectedLoadA * 48;

  const backupHoursBefore =
    presentWatts > 0 ? (usableBatteryWattHours / presentWatts).toFixed(1) : 'No Load';
  const backupHoursAfter =
    projectedWatts > 0 ? (usableBatteryWattHours / projectedWatts).toFixed(1) : 'No Load';

  const additionalModulesNeeded =
    capacitySurplusA < 0 && rectifierRatingA > 0
      ? Math.ceil(Math.abs(capacitySurplusA) / (rectifierRatingA * 0.9))
      : 0;

  // --- Calculations for Link Budget ---
  // Free space loss: 92.45 + 20*log10(f GHz) + 20*log10(d km)
  const freeSpaceLoss =
    freqGhz > 0 && distanceKm > 0
      ? 92.45 + 20 * Math.log10(freqGhz) + 20 * Math.log10(distanceKm)
      : 0;
  const computedExpectedRsl =
    txPowerDbm + txGainDbi + rxGainDbi - freeSpaceLoss - miscLossDb;

  // --- Calculations for Great-Circle Bearing & Distance between Site A and Site B ---
  const calculateBearing = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x =
      Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    return ((θ * 180) / Math.PI + 360) % 360;
  };

  const bearingBtoA = calculateBearing(siteB.lat, siteB.long, siteA.lat, siteA.long);
  const bearingAtoB = calculateBearing(siteA.lat, siteA.long, siteB.lat, siteB.long);

  // --- DMS / Decimal Conversion Helpers ---
  const convertDecToDms = (val: number, isLat: boolean) => {
    const dir = isLat ? (val >= 0 ? 'N' : 'S') : val >= 0 ? 'E' : 'W';
    const abs = Math.abs(val);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = ((minFloat - min) * 60).toFixed(2);
    return { deg, min, sec, dir };
  };

  const handleDecimalConvert = () => {
    const lat = parseFloat(inputLatDec);
    const lon = parseFloat(inputLongDec);
    if (!isNaN(lat)) {
      const d = convertDecToDms(lat, true);
      setDmsLatDeg(d.deg.toString());
      setDmsLatMin(d.min.toString());
      setDmsLatSec(d.sec);
      setDmsLatDir(d.dir as any);
    }
    if (!isNaN(lon)) {
      const d = convertDecToDms(lon, false);
      setDmsLongDeg(d.deg.toString());
      setDmsLongMin(d.min.toString());
      setDmsLongSec(d.sec);
      setDmsLongDir(d.dir as any);
    }
  };

  const handleDmsConvert = () => {
    const latDeg = parseFloat(dmsLatDeg) || 0;
    const latMin = parseFloat(dmsLatMin) || 0;
    const latSec = parseFloat(dmsLatSec) || 0;
    let latDec = latDeg + latMin / 60 + latSec / 3600;
    if (dmsLatDir === 'S') latDec = -latDec;

    const lonDeg = parseFloat(dmsLongDeg) || 0;
    const lonMin = parseFloat(dmsLongMin) || 0;
    const lonSec = parseFloat(dmsLongSec) || 0;
    let lonDec = lonDeg + lonMin / 60 + lonSec / 3600;
    if (dmsLongDir === 'W') lonDec = -lonDec;

    setInputLatDec(latDec.toFixed(5));
    setInputLongDec(lonDec.toFixed(5));
  };

  return (
    <div className="space-y-4">
      {/* Tool Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {[
          { id: 'ALIGNMENT_ENGINE', label: 'AlignmentEngine™', icon: Activity },
          { id: 'BATTERY_TELEMETRY', label: 'Battery Telemetry', icon: BatteryCharging },
          { id: 'POWER', label: 'Power Sufficiency', icon: Zap },
          { id: 'LINK_BUDGET', label: 'Link Budget Check', icon: Radio },
          { id: 'COMPASS', label: 'Azimuth & Bearing', icon: Compass },
          { id: 'DMS_CONVERTER', label: 'DMS / GPS Tool', icon: ArrowRightLeft },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTool === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTool(tab.id as any)}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-bold min-h-[44px] ${
                isActive
                  ? 'bg-cyan-600 text-white border-cyan-500 shadow-md shadow-cyan-950/40'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* BATTERY TELEMETRY & TOWER DISCHARGE ALERTS */}
      {activeTool === 'BATTERY_TELEMETRY' && (
        <BatteryTelemetry
          sunlightMode={sunlightMode}
          siteName={siteB.name}
          technicianRole="TOWER_CLIMBER"
          onEmergencyPersist={() => storage.flushToEdgeStorage()}
        />
      )}

      {/* ALIGNMENT ENGINE SENSOR HUD & DATA LOGGER */}
      {activeTool === 'ALIGNMENT_ENGINE' && (
        <AlignmentEngine
          targetAzimuth={bearingBtoA}
          targetElevation={0.12}
          siteName={siteB.name}
          hopName={hop.hopName}
          sunlightMode={sunlightMode}
        />
      )}

      {/* 1. POWER SUFFICIENCY CALCULATOR */}
      {activeTool === 'POWER' && (
        <div className="p-4 sm:p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 text-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                Telecom Power Sufficiency Study (-48V DC)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Evaluates N+1 rectifier redundancy, battery reserve backup hours, and MW equipment added load.
              </p>
            </div>
            {/* Survey Incomplete / Unenergized Warning Badge */}
            {!rectifierEnergized && (
              <div className="px-2.5 py-1 rounded bg-amber-950/80 border border-amber-700 text-amber-300 text-[11px] font-mono flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Site B TSSR: Commercial MCB not yet energized</span>
              </div>
            )}
          </div>

          {/* Inputs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {/* Rectifier Setup */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
              <span className="font-bold text-cyan-300 block uppercase font-mono text-[11px]">
                1. Rectifier System
              </span>
              <div>
                <label className="text-slate-400 block mb-1">Modules Installed</label>
                <input
                  type="number"
                  min="1"
                  value={rectifierCount}
                  onChange={(e) => setRectifierCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-white text-sm"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Module Rating (Amperes)</label>
                <input
                  type="number"
                  value={rectifierRatingA}
                  onChange={(e) => setRectifierRatingA(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-white text-sm"
                />
              </div>
              <label className="flex items-center gap-2 pt-1 text-[11px] text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rectifierEnergized}
                  onChange={(e) => setRectifierEnergized(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-cyan-600 bg-slate-900 border-slate-700"
                />
                <span>Rectifier is energized</span>
              </label>
            </div>

            {/* Battery Banks */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
              <span className="font-bold text-purple-300 block uppercase font-mono text-[11px]">
                2. Battery Bank Reserve
              </span>
              <div>
                <label className="text-slate-400 block mb-1">Battery String Capacity (Ah)</label>
                <input
                  type="number"
                  value={batteryAh}
                  onChange={(e) => setBatteryAh(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-white text-sm"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Number of Strings / Banks</label>
                <input
                  type="number"
                  min="1"
                  value={batteryBanks}
                  onChange={(e) => setBatteryBanks(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-white text-sm"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Present Site Load (A)</label>
                <input
                  type="number"
                  step="0.5"
                  value={presentSiteLoadA}
                  onChange={(e) => setPresentSiteLoadA(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-white text-sm"
                />
              </div>
            </div>

            {/* Added MW Equipment */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
              <span className="font-bold text-emerald-300 block uppercase font-mono text-[11px]">
                3. Microwave Added Loads
              </span>
              <div className="flex items-center justify-between text-[11px]">
                <span>Huawei NR9150 IDU (120.84W):</span>
                <input
                  type="number"
                  min="0"
                  max="4"
                  value={nr9150Count}
                  onChange={(e) => setNr9150Count(parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-center font-mono text-xs"
                />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span>ER2020 Radio (50.88W):</span>
                <input
                  type="number"
                  min="0"
                  max="4"
                  value={er2020Count}
                  onChange={(e) => setEr2020Count(parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-center font-mono text-xs"
                />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span>SRU3D/HRU3D (127.2W):</span>
                <input
                  type="number"
                  min="0"
                  max="4"
                  value={sru3dCount}
                  onChange={(e) => setSru3dCount(parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-center font-mono text-xs"
                />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span>Cable & Conversion Loss (%):</span>
                <input
                  type="number"
                  value={lossFactorPct}
                  onChange={(e) => setLossFactorPct(parseFloat(e.target.value) || 0)}
                  className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-center font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* Results Summary Dashboard */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Total Added Current:</span>
              <p className="font-mono text-lg font-bold text-cyan-400 mt-0.5">
                {totalAddedCurrentA.toFixed(2)} A
              </p>
              <p className="text-[10px] text-slate-500 font-mono">
                {totalWattsWithLoss.toFixed(1)} Watts at -48V
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Usable Rectifier (N+1):</span>
              <p className="font-mono text-lg font-bold text-white mt-0.5">
                {usableRectifierCapacityA.toFixed(1)} A
              </p>
              <p className="text-[10px] text-slate-500 font-mono">
                Minus 1 module & 10% chg
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Rectifier Margin:</span>
              <p
                className={`font-mono text-lg font-bold mt-0.5 ${
                  capacitySurplusA >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {capacitySurplusA >= 0 ? `+${capacitySurplusA.toFixed(1)}` : capacitySurplusA.toFixed(1)} A
              </p>
              <p className="text-[10px] text-slate-500 font-mono">
                {capacitySurplusA >= 0 ? 'Adequate capacity' : `Deficit! Add ${additionalModulesNeeded} mod`}
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Battery Runtime:</span>
              <p className="font-mono text-lg font-bold text-purple-400 mt-0.5">
                {backupHoursAfter} hrs
              </p>
              <p className="text-[10px] text-slate-500 font-mono">
                Was {backupHoursBefore} hrs (80% DoD)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. LINK BUDGET QUICK-CHECK */}
      {activeTool === 'LINK_BUDGET' && (
        <div className="p-4 sm:p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 text-slate-200">
          <div className="pb-3 border-b border-slate-800">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-cyan-400" />
              RF Microwave Link Budget & Fade Margin Calculator
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Computes Free-Space Path Loss (ITU-R P.525-4), Expected RSL, and compares against 4096QAM thresholds.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <label className="text-slate-400 block text-[11px]">Freq (GHz)</label>
              <input
                type="number"
                step="0.5"
                value={freqGhz}
                onChange={(e) => setFreqGhz(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono font-bold text-white text-sm"
              />
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <label className="text-slate-400 block text-[11px]">Distance (km)</label>
              <input
                type="number"
                step="0.01"
                value={distanceKm}
                onChange={(e) => setDistanceKm(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono font-bold text-white text-sm"
              />
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <label className="text-slate-400 block text-[11px]">TX Power (dBm)</label>
              <input
                type="number"
                step="0.5"
                value={txPowerDbm}
                onChange={(e) => setTxPowerDbm(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono font-bold text-white text-sm"
              />
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <label className="text-slate-400 block text-[11px]">TX Ant Gain (dBi)</label>
              <input
                type="number"
                step="0.1"
                value={txGainDbi}
                onChange={(e) => setTxGainDbi(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono font-bold text-white text-sm"
              />
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <label className="text-slate-400 block text-[11px]">RX Ant Gain (dBi)</label>
              <input
                type="number"
                step="0.1"
                value={rxGainDbi}
                onChange={(e) => setRxGainDbi(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono font-bold text-white text-sm"
              />
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <label className="text-slate-400 block text-[11px]">Misc Loss (dB)</label>
              <input
                type="number"
                step="0.1"
                value={miscLossDb}
                onChange={(e) => setMiscLossDb(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono font-bold text-white text-sm"
              />
            </div>
          </div>

          {/* Link Budget Results */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-xs text-slate-400 font-mono">Free Space Path Loss (FSL):</span>
              <p className="text-xl font-bold font-mono text-cyan-400 mt-1">
                {freeSpaceLoss.toFixed(2)} dB
              </p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                Formula: 92.45 + 20·log(f) + 20·log(d)
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-xs text-slate-400 font-mono">Expected RSL at Receiver:</span>
              <p className="text-xl font-bold font-mono text-emerald-400 mt-1">
                {computedExpectedRsl.toFixed(2)} dBm
              </p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                TSSR Target: {hop.expectedRslDbm} dBm
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-xs text-slate-400 font-mono">Thermal Fade Margin (4096QAM):</span>
              <p className="text-xl font-bold font-mono text-purple-400 mt-1">
                {(Math.abs(computedExpectedRsl) - 54.0 > 0
                  ? (54.0 - Math.abs(computedExpectedRsl)).toFixed(2)
                  : (Math.abs(-54.0) - Math.abs(computedExpectedRsl)).toFixed(2))} dB
              </p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                Above -54.0 dBm threshold (Passed)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. COMPASS & BEARING HELPER */}
      {activeTool === 'COMPASS' && (
        <div className="p-4 sm:p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 text-slate-200">
          <div className="pb-3 border-b border-slate-800">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Compass className="w-5 h-5 text-cyan-400" />
              Azimuth & Great-Circle Bearing Compass
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Calculates forward azimuth between Site A and Site B with magnetic declination correction.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hop Bearing Display */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-xs font-mono text-cyan-400 uppercase font-bold">
                  Site B ({siteB.id}) pointing to Site A
                </span>
                <p className="text-2xl font-mono font-extrabold text-white mt-1">
                  {bearingBtoA.toFixed(2)}°
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Magnetic Heading: {(bearingBtoA - magneticDeclination).toFixed(2)}° (Declination: +{magneticDeclination}°E)
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-xs font-mono text-purple-400 uppercase font-bold">
                  Site A ({siteA.id}) pointing to Site B
                </span>
                <p className="text-2xl font-mono font-extrabold text-white mt-1">
                  {bearingAtoB.toFixed(2)}°
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Difference: {Math.abs(bearingBtoA - bearingAtoB).toFixed(2)}° (Reciprocal: exactly 180° ± 0.05°)
                </p>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-400">Magnetic Declination Adjustment (°):</span>
                <input
                  type="number"
                  step="0.1"
                  value={magneticDeclination}
                  onChange={(e) => setMagneticDeclination(parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-center text-white"
                />
              </div>
            </div>

            {/* Live Gyro / Compass Visualizer */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center text-center">
              <div className="relative w-48 h-48 rounded-full border-4 border-slate-800 flex items-center justify-center bg-slate-900/60 shadow-inner">
                {/* Target Azimuth Indicator Ring */}
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  style={{ transform: `rotate(${bearingBtoA}deg)` }}
                >
                  <div className="w-1 h-24 bg-cyan-400 origin-bottom mb-24 rounded-full shadow-lg shadow-cyan-400/80" />
                  <span className="absolute top-2 text-[10px] font-mono font-bold text-cyan-300">
                    TARGET 241°
                  </span>
                </div>

                {/* Device orientation needle */}
                <div
                  className="w-1.5 h-36 bg-rose-500 rounded-full transition-transform duration-200 shadow-md"
                  style={{
                    transform: `rotate(${deviceHeading !== null ? deviceHeading : 241}deg)`,
                  }}
                />

                <div className="w-8 h-8 rounded-full bg-slate-950 border-2 border-slate-700 flex items-center justify-center z-10">
                  <Navigation2 className="w-4 h-4 text-cyan-400" />
                </div>
              </div>

              <p className="text-xs font-mono font-bold text-slate-200 mt-3">
                {deviceHeading !== null ? `Heading: ${deviceHeading}°` : 'Heading: 241.0° (Locked to Target)'}
              </p>
              <p className="text-[11px] text-slate-500">
                Align green needle with top target pointer for primary antenna boresight
              </p>

              <button
                type="button"
                onClick={() => setShowSensorModal(true)}
                className="mt-3 px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-cyan-950/40"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Launch Real-Time Sensor HUD</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. DMS / DECIMAL CONVERTER */}
      {activeTool === 'DMS_CONVERTER' && (
        <div className="p-4 sm:p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 text-slate-200">
          <div className="pb-3 border-b border-slate-800">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-cyan-400" />
              GPS Coordinate Converter (Decimal Degrees ⮂ DMS)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Accurately convert coordinates between surveyor GPS formats and TSSR specifications.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Decimal Input Box */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <span className="font-bold text-cyan-300 block uppercase font-mono text-[11px]">
                Decimal Degrees (DD)
              </span>
              <div>
                <label className="text-slate-400 block mb-1">Latitude</label>
                <input
                  type="text"
                  value={inputLatDec}
                  onChange={(e) => setInputLatDec(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 font-mono text-sm text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Longitude</label>
                <input
                  type="text"
                  value={inputLongDec}
                  onChange={(e) => setInputLongDec(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 font-mono text-sm text-white"
                />
              </div>
              <button
                type="button"
                onClick={handleDecimalConvert}
                className="w-full py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs"
              >
                Convert to DMS ➔
              </button>
            </div>

            {/* DMS Input Box */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <span className="font-bold text-emerald-300 block uppercase font-mono text-[11px]">
                Degrees, Minutes, Seconds (DMS)
              </span>

              {/* Latitude DMS */}
              <div>
                <label className="text-slate-400 block mb-1">Latitude (Deg / Min / Sec)</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Deg"
                    value={dmsLatDeg}
                    onChange={(e) => setDmsLatDeg(e.target.value)}
                    className="w-16 px-2 py-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-center text-white"
                  />
                  <input
                    type="text"
                    placeholder="Min"
                    value={dmsLatMin}
                    onChange={(e) => setDmsLatMin(e.target.value)}
                    className="w-16 px-2 py-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-center text-white"
                  />
                  <input
                    type="text"
                    placeholder="Sec"
                    value={dmsLatSec}
                    onChange={(e) => setDmsLatSec(e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-center text-white"
                  />
                  <select
                    value={dmsLatDir}
                    onChange={(e) => setDmsLatDir(e.target.value as any)}
                    className="w-14 px-1 rounded bg-slate-900 border border-slate-700 font-mono text-cyan-400 font-bold"
                  >
                    <option value="N">N</option>
                    <option value="S">S</option>
                  </select>
                </div>
              </div>

              {/* Longitude DMS */}
              <div>
                <label className="text-slate-400 block mb-1">Longitude (Deg / Min / Sec)</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Deg"
                    value={dmsLongDeg}
                    onChange={(e) => setDmsLongDeg(e.target.value)}
                    className="w-16 px-2 py-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-center text-white"
                  />
                  <input
                    type="text"
                    placeholder="Min"
                    value={dmsLongMin}
                    onChange={(e) => setDmsLongMin(e.target.value)}
                    className="w-16 px-2 py-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-center text-white"
                  />
                  <input
                    type="text"
                    placeholder="Sec"
                    value={dmsLongSec}
                    onChange={(e) => setDmsLongSec(e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded bg-slate-900 border border-slate-700 font-mono text-center text-white"
                  />
                  <select
                    value={dmsLongDir}
                    onChange={(e) => setDmsLongDir(e.target.value as any)}
                    className="w-14 px-1 rounded bg-slate-900 border border-slate-700 font-mono text-cyan-400 font-bold"
                  >
                    <option value="E">E</option>
                    <option value="W">W</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDmsConvert}
                className="w-full py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
              >
                Convert to Decimal ➔
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Sensor Antenna Alignment Modal */}
      <SensorAlignmentModal
        isOpen={showSensorModal}
        onClose={() => setShowSensorModal(false)}
        targetAzimuth={bearingBtoA}
        targetElevation={0.12}
        siteName={siteB.name}
        hopName={hop.hopName}
        sunlightMode={sunlightMode}
      />
    </div>
  );
};
