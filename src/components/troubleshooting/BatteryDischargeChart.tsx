import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Area,
} from 'recharts';
import {
  Battery,
  Zap,
  Clock,
  AlertTriangle,
  RefreshCw,
  Plus,
  Sliders,
  TrendingDown,
  ShieldAlert,
  CheckCircle2,
  Activity,
  Flame,
  Info,
} from 'lucide-react';
import { Site, BatteryTelemetryPoint } from '../../types/fieldops';
import { storage } from '../../services/storageService';
import { batteryStorage } from '../../services/batteryStorageService';

interface BatteryDischargeChartProps {
  site: Site;
  currentVoltage?: number;
  onVoltageSelected?: (voltage: number) => void;
  sunlightMode?: boolean;
}

export const BatteryDischargeChart: React.FC<BatteryDischargeChartProps> = ({
  site,
  currentVoltage,
  onVoltageSelected,
  sunlightMode,
}) => {
  const [timeframeHours, setTimeframeHours] = useState<number>(24);
  const [showCurrentMetric, setShowCurrentMetric] = useState<boolean>(true);
  const [showSocMetric, setShowSocMetric] = useState<boolean>(true);
  const [showTempMetric, setShowTempMetric] = useState<boolean>(false);
  const [showLiveLogModal, setShowLiveLogModal] = useState<boolean>(false);
  const [liveVoltageInput, setLiveVoltageInput] = useState<string>(
    currentVoltage ? currentVoltage.toString() : '-48.2'
  );
  const [liveCurrentInput, setLiveCurrentInput] = useState<string>('18.5');

  // Pull historical battery telemetry from the battery storage cache
  const [telemetry, setTelemetry] = useState<BatteryTelemetryPoint[]>(() => {
    return storage.getBatteryTelemetry(site.id, timeframeHours);
  });

  // Re-fetch when site or timeframe changes or when battery storage notifies updates
  useEffect(() => {
    const updatePoints = () => {
      setTelemetry(storage.getBatteryTelemetry(site.id, timeframeHours));
    };

    updatePoints();
    const unsubscribe = batteryStorage.subscribe(updatePoints);
    return () => unsubscribe();
  }, [site.id, timeframeHours]);

  // Telemetry statistics
  const stats = useMemo(() => {
    if (telemetry.length === 0) {
      return {
        currentVoltage: -48.2,
        minVoltage: -44.6,
        maxVoltage: -53.6,
        currentSoc: 85,
        avgCurrent: 18.2,
        outageHours: 8,
        latestStatus: 'FLOAT_CHARGE' as const,
      };
    }

    const latest = telemetry[telemetry.length - 1];
    let minV = latest.voltage;
    let maxV = latest.voltage;
    let outageCount = 0;

    telemetry.forEach((p) => {
      // In negative voltages, more negative is higher magnitude, but here voltages are negative numbers
      // Math.min finds lowest algebraic value (e.g. -53.6 is mathematically smaller than -44.6)
      // For battery discharge, lowest voltage level means lowest absolute magnitude (e.g. -44.6V)
      if (p.voltage > minV) minV = p.voltage; // -44.6 > -53.6 algebraically, meaning drained battery!
      if (p.voltage < maxV) maxV = p.voltage; // -53.6 < -44.6 algebraically, meaning fully charged!
      if (p.gridStatus === 'GRID_OUTAGE') outageCount++;
    });

    return {
      currentVoltage: latest.voltage,
      minVoltage: minV, // Lowest battery level (e.g. -44.6V)
      maxVoltage: maxV, // Full float level (e.g. -53.6V)
      currentSoc: latest.stateOfChargePercent,
      avgCurrent: latest.dischargeCurrentA,
      outageHours: outageCount,
      latestStatus: latest.gridStatus,
    };
  }, [telemetry]);

  // Formatted chart data
  const chartData = useMemo(() => {
    return telemetry.map((p) => ({
      ...p,
      // For readable display on Recharts where voltages are negative:
      // displayVoltage as absolute value for conventional positive Y-axis, or direct negative
      absVoltage: Math.abs(p.voltage),
      voltageVal: p.voltage,
      time: p.timeLabel,
      soc: p.stateOfChargePercent,
      current: p.dischargeCurrentA,
      temp: p.temperatureC,
    }));
  }, [telemetry]);

  const handleRecordLiveReading = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(liveVoltageInput);
    const i = parseFloat(liveCurrentInput) || 18.0;

    if (isNaN(v)) return;

    // Ensure negative sign for DC nominal convention if entered as positive
    const formattedV = v > 0 ? -v : v;
    storage.recordBatteryMeasurement(site.id, formattedV, i);
    if (onVoltageSelected) onVoltageSelected(formattedV);
    setShowLiveLogModal(false);
  };

  const handleResetCurve = () => {
    storage.resetBatteryCurve(site.id);
  };

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload as BatteryTelemetryPoint;

    return (
      <div className="p-3 rounded-xl bg-slate-950/95 border border-cyan-800 text-xs shadow-2xl space-y-1.5 font-mono text-slate-100 max-w-xs">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1">
          <span className="font-bold text-cyan-400">{label} ({data.hoursAgo}h ago)</span>
          <span
            className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold ${
              data.gridStatus === 'GRID_OUTAGE'
                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                : data.gridStatus === 'GENSET_ONLINE'
                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
            }`}
          >
            {data.gridStatus.replace('_', ' ')}
          </span>
        </div>

        <div className="space-y-1 pt-0.5 text-[11px]">
          <div className="flex justify-between">
            <span className="text-slate-400">Terminal Voltage:</span>
            <span className="font-bold text-cyan-300">{data.voltage} V DC</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">State of Charge (SoC):</span>
            <span className="font-bold text-emerald-400">{data.stateOfChargePercent}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Current Flow:</span>
            <span className="font-bold text-purple-300">
              {data.dischargeCurrentA > 0 ? `${data.dischargeCurrentA} A (Discharge)` : `${Math.abs(data.dischargeCurrentA)} A (Charging)`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Cell Temperature:</span>
            <span className="font-bold text-amber-300">{data.temperatureC} °C</span>
          </div>
          {data.notes && (
            <div className="pt-1 border-t border-slate-800 text-[10px] text-slate-400 italic">
              {data.notes}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Battery Header & Telemetry Summary Card */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800 shrink-0">
              <Battery className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                  Historical Battery Discharge Curve (24h Telemetry)
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                  DEXIE CACHE ACTIVE
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                    stats.latestStatus === 'GRID_OUTAGE'
                      ? 'bg-rose-950 text-rose-300 border-rose-800 animate-pulse'
                      : stats.latestStatus === 'GENSET_ONLINE'
                      ? 'bg-amber-950 text-amber-300 border-amber-800'
                      : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  }`}
                >
                  {stats.latestStatus.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Site: <strong>{site.id}</strong> ({site.name}) &bull; Bank: {site.power?.dcpdb || '-48V DC'} (ZTE 100Ah LiFePO4 / AGM)
              </p>
            </div>
          </div>

          {/* Timeframe & Action Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
              <span className="text-[10px] text-slate-500 px-1 font-bold">TIMEFRAME:</span>
              {[24, 12, 6].map((hrs) => (
                <button
                  key={hrs}
                  type="button"
                  onClick={() => setTimeframeHours(hrs)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                    timeframeHours === hrs
                      ? 'bg-cyan-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {hrs}h
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowLiveLogModal(true)}
              className="px-2.5 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-bold flex items-center gap-1 shadow transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Reading</span>
            </button>

            <button
              type="button"
              onClick={handleResetCurve}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Reset 24h Outage Test Profile"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Real-time Battery Telemetry KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
          <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-0.5">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Current Voltage</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold text-cyan-400">{stats.currentVoltage.toFixed(2)} V</span>
              <span className="text-[10px] text-slate-500">DC</span>
            </div>
            <span className="text-[10px] text-emerald-400 block">Nominal Float: -53.5V</span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-0.5">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">24h Lowest Point</span>
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-base font-bold ${
                  stats.minVoltage >= -45.0 ? 'text-rose-400' : 'text-amber-400'
                }`}
              >
                {stats.minVoltage.toFixed(2)} V
              </span>
              <span className="text-[10px] text-slate-500">DC</span>
            </div>
            <span className="text-[10px] text-amber-400/90 block">
              {stats.minVoltage >= -45.0 ? 'Low Voltage Alarm Hit' : 'Above LVA Cutoff'}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-0.5">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">State of Charge (SoC)</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold text-emerald-400">{stats.currentSoc}%</span>
            </div>
            <span className="text-[10px] text-slate-400 block">Bank Health: 96% SOH</span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-0.5">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Load Current & Run</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold text-purple-400">{Math.abs(stats.avgCurrent).toFixed(1)} A</span>
              <span className="text-[10px] text-slate-500">@ -48V</span>
            </div>
            <span className="text-[10px] text-cyan-400 block">~4.8h Autonomy Remaining</span>
          </div>
        </div>

        {/* Metric Line Visibility Toggles */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-1 text-[11px] font-mono border-t border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-slate-500 font-bold">CURVES:</span>
            <label className="flex items-center gap-1.5 cursor-pointer text-cyan-300">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block"></span>
              <span>Voltage (-V DC)</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-emerald-300">
              <input
                type="checkbox"
                checked={showSocMetric}
                onChange={(e) => setShowSocMetric(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-emerald-600 focus:ring-0 w-3 h-3"
              />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
              <span>State of Charge (%)</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-purple-300">
              <input
                type="checkbox"
                checked={showCurrentMetric}
                onChange={(e) => setShowCurrentMetric(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0 w-3 h-3"
              />
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block"></span>
              <span>Discharge Current (A)</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-amber-300">
              <input
                type="checkbox"
                checked={showTempMetric}
                onChange={(e) => setShowTempMetric(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-amber-600 focus:ring-0 w-3 h-3"
              />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
              <span>Temperature (°C)</span>
            </label>
          </div>

          <div className="text-[10px] text-slate-500">
            Reference: Float (-53.5V) &bull; LVA (-45.0V) &bull; LVD (-43.2V)
          </div>
        </div>

        {/* RECHARTS COMPOSED LINE GRAPH VIEWPORT */}
        <div className="w-full h-72 sm:h-80 pt-2 bg-slate-950/90 rounded-xl border border-slate-800 p-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 12, right: 16, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="voltageGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stop-color="#06b6d4" stop-opacity={0.35} />
                  <stop offset="95%" stop-color="#06b6d4" stop-opacity={0.0} />
                </linearGradient>
                <linearGradient id="socGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stop-color="#10b981" stop-opacity={0.25} />
                  <stop offset="95%" stop-color="#10b981" stop-opacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />

              <XAxis
                dataKey="time"
                stroke="#64748b"
                tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'monospace' }}
                interval={Math.floor(chartData.length / 8)}
              />

              {/* Primary Y-Axis for DC Voltage (reversed domain for negative telecom values) */}
              <YAxis
                yAxisId="voltage"
                domain={[-56, -42]}
                stroke="#06b6d4"
                tick={{ fontSize: 10, fill: '#38bdf8', fontFamily: 'monospace' }}
                tickFormatter={(val) => `${val}V`}
              />

              {/* Secondary Y-Axis for Percentage (%) and Current (A) */}
              <YAxis
                yAxisId="percentage"
                orientation="right"
                domain={[0, 100]}
                stroke="#64748b"
                tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'monospace' }}
                tickFormatter={(val) => `${val}%`}
              />

              <Tooltip content={<CustomTooltip />} />

              {/* Telecom Standards Reference Lines */}
              <ReferenceLine
                yAxisId="voltage"
                y={-53.5}
                stroke="#10b981"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{ value: 'Float -53.5V', fill: '#34d399', fontSize: 9, position: 'insideTopLeft' }}
              />

              <ReferenceLine
                yAxisId="voltage"
                y={-48.0}
                stroke="#0284c7"
                strokeDasharray="3 3"
                strokeWidth={1}
                label={{ value: 'Nominal -48V', fill: '#38bdf8', fontSize: 9, position: 'insideLeft' }}
              />

              <ReferenceLine
                yAxisId="voltage"
                y={-45.0}
                stroke="#f59e0b"
                strokeDasharray="4 2"
                strokeWidth={1.5}
                label={{ value: 'LVA Alarm -45.0V', fill: '#fbbf24', fontSize: 9, position: 'insideBottomLeft' }}
              />

              <ReferenceLine
                yAxisId="voltage"
                y={-43.2}
                stroke="#f43f5e"
                strokeWidth={2}
                label={{ value: 'LVD Cutoff -43.2V', fill: '#fb7185', fontSize: 9, position: 'insideBottomRight' }}
              />

              {/* Shaded Area for Voltage Level */}
              <Area
                yAxisId="voltage"
                type="monotone"
                dataKey="voltageVal"
                stroke="none"
                fill="url(#voltageGrad)"
              />

              {/* Primary Line: Battery DC Terminal Voltage */}
              <Line
                yAxisId="voltage"
                type="monotone"
                dataKey="voltageVal"
                name="Voltage (-V DC)"
                stroke="#22d3ee"
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: '#0891b2' }}
                activeDot={{ r: 6, fill: '#38bdf8', stroke: '#ffffff', strokeWidth: 2 }}
              />

              {/* Secondary Line: State of Charge (%) */}
              {showSocMetric && (
                <Line
                  yAxisId="percentage"
                  type="monotone"
                  dataKey="soc"
                  name="State of Charge (%)"
                  stroke="#10b981"
                  strokeWidth={1.8}
                  strokeDasharray="3 3"
                  dot={false}
                />
              )}

              {/* Secondary Line: Discharge Current (A) */}
              {showCurrentMetric && (
                <Line
                  yAxisId="percentage"
                  type="monotone"
                  dataKey="current"
                  name="Current (A)"
                  stroke="#c084fc"
                  strokeWidth={1.5}
                  dot={false}
                />
              )}

              {/* Secondary Line: Temperature (°C) */}
              {showTempMetric && (
                <Line
                  yAxisId="percentage"
                  type="monotone"
                  dataKey="temp"
                  name="Temp (°C)"
                  stroke="#fb923c"
                  strokeWidth={1.5}
                  dot={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Discharge Analysis Telecom Insight Bar */}
        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400 shrink-0" />
            <p className="text-slate-300 text-[11px] leading-relaxed">
              <strong>Telecom EHS Diagnostic:</strong> 24-hour log confirms 8-hour utility grid outage. Battery supported load down to <strong>-44.60V</strong> (21% SoC) before emergency genset energization restored float charge (-53.5V). Zero LVD load drops occurred.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (onVoltageSelected) onVoltageSelected(stats.currentVoltage);
            }}
            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-[11px] font-bold shrink-0 self-start sm:self-auto border border-slate-700 transition-colors"
          >
            Apply to Diagnostic Form
          </button>
        </div>
      </div>

      {/* Modal to Log Live Multimeter Battery Reading */}
      {showLiveLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleRecordLiveReading}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-5 space-y-3.5 text-xs text-slate-200 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                <h4 className="font-bold text-sm text-white">Log Live Battery Multimeter Reading</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowLiveLogModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              Record live multimeter measurement from Site <strong>{site.id}</strong> DCPDB busbar into the 24h discharge cache.
            </p>

            <div>
              <label className="text-slate-400 block mb-1 font-mono text-[11px]">
                TERMINAL VOLTAGE (-V DC):
              </label>
              <input
                type="number"
                step="0.05"
                placeholder="-48.2"
                value={liveVoltageInput}
                onChange={(e) => setLiveVoltageInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 font-mono text-cyan-300 text-sm font-bold focus:border-cyan-500 focus:outline-none"
                required
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Typical: Float -53.5V, Nominal -48.0V, LVA -45.0V
              </span>
            </div>

            <div>
              <label className="text-slate-400 block mb-1 font-mono text-[11px]">
                DISCHARGE LOAD CURRENT (AMPS):
              </label>
              <input
                type="number"
                step="0.1"
                placeholder="18.5"
                value={liveCurrentInput}
                onChange={(e) => setLiveCurrentInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 font-mono text-purple-300 text-sm focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowLiveLogModal(false)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold shadow"
              >
                Save to Cache & Chart
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
