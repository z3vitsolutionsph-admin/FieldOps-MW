import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import {
  Compass,
  Activity,
  Play,
  Square,
  Download,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  VolumeX,
  Sliders,
  Smartphone,
  CheckSquare,
  FileText,
  Clock,
  Zap,
  TrendingUp,
  Pause,
  RotateCcw,
  ShieldCheck,
  Eye,
  Vibrate,
} from 'lucide-react';

export interface AlignmentSample {
  id: string;
  timestamp: string;
  azimuth: number;
  elevation: number;
  roll: number;
  stabilityScore: number; // 0 - 100%
  accelerationMagnitude: number;
}

export interface RealtimeTelemetryPoint {
  timeStr: string;
  timestamp: number;
  stabilityScore: number;
  azimuthDelta: number;
  elevationDelta: number;
  vibration: number;
  roll: number;
}

export interface AlignmentSession {
  sessionId: string;
  startTime: string;
  endTime?: string;
  targetAzimuth: number;
  targetElevation: number;
  samples: AlignmentSample[];
  averageAzimuth: number;
  averageElevation: number;
  peakStability: number;
  status: 'RECORDING' | 'SAVED' | 'LOCKED';
  notes?: string;
}

interface AlignmentEngineProps {
  targetAzimuth?: number;
  targetElevation?: number;
  siteName?: string;
  hopName?: string;
  sunlightMode?: boolean;
  onSaveSession?: (session: AlignmentSession) => void;
}

const STORAGE_KEY_SESSIONS = 'fieldops_alignment_sessions_cache';

// Helper to pre-populate 30 seconds of telemetry buffer
const generateInitial30sBuffer = (targetAz: number, targetEl: number): RealtimeTelemetryPoint[] => {
  const now = Date.now();
  const buffer: RealtimeTelemetryPoint[] = [];
  for (let i = 30; i >= 0; i--) {
    const t = now - i * 1000;
    const azD = Math.sin(i / 4.5) * 0.9 + 0.2;
    const elD = Math.cos(i / 5.5) * 0.3;
    const vib = 0.04 + Math.random() * 0.06;
    const stab = Math.max(
      0,
      Math.min(100, Math.round(94 - Math.abs(azD) * 10 - Math.abs(elD) * 15 - vib * 10))
    );
    buffer.push({
      timeStr: i === 0 ? 'now' : `-${i}s`,
      timestamp: t,
      stabilityScore: stab,
      azimuthDelta: parseFloat(azD.toFixed(2)),
      elevationDelta: parseFloat(elD.toFixed(2)),
      vibration: parseFloat(vib.toFixed(2)),
      roll: 0.1,
    });
  }
  return buffer;
};

// Custom Tooltip for Recharts
const AlignmentTrendTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="p-2.5 rounded-lg bg-slate-950/95 border border-slate-700 shadow-2xl backdrop-blur-md text-xs font-mono space-y-1.5 z-50 min-w-44">
      <div className="text-slate-400 font-bold border-b border-slate-800 pb-1 flex justify-between items-center text-[11px]">
        <span>Time Offset: {label}</span>
        <span className="text-cyan-400 text-[10px]">1 Hz Live</span>
      </div>
      {payload.map((entry: any, index: number) => {
        let unit = '°';
        if (entry.dataKey === 'stabilityScore') unit = '%';
        if (entry.dataKey === 'vibration') unit = ' m/s²';

        return (
          <div key={`item-${index}`} className="flex items-center justify-between gap-3 text-[11px]">
            <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
              {entry.name}:
            </span>
            <span className="font-bold text-white">
              {entry.value > 0 && entry.dataKey.includes('Delta') ? `+${entry.value}` : entry.value}
              {unit}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const AlignmentEngine: React.FC<AlignmentEngineProps> = ({
  targetAzimuth = 241.02,
  targetElevation = 0.12,
  siteName = 'Site B (Catangnan)',
  hopName = 'NS-TER25-A062 to NS-TER25-A035',
  sunlightMode = false,
  onSaveSession,
}) => {
  // Live Sensor State
  const [azimuth, setAzimuth] = useState<number>(239.0);
  const [elevation, setElevation] = useState<number>(0.05);
  const [roll, setRoll] = useState<number>(0.2);
  const [accelMag, setAccelMag] = useState<number>(9.81);
  const [isSensorActive, setIsSensorActive] = useState<boolean>(false);
  const [sensorError, setSensorError] = useState<string | null>(null);
  const [useSimulation, setUseSimulation] = useState<boolean>(false);

  // 30-Second Rolling Window Recharts State
  const [trendBuffer, setTrendBuffer] = useState<RealtimeTelemetryPoint[]>(() =>
    generateInitial30sBuffer(targetAzimuth, targetElevation)
  );
  const [isChartPaused, setIsChartPaused] = useState<boolean>(false);
  const [showStabilityMetric, setShowStabilityMetric] = useState<boolean>(true);
  const [showAzimuthMetric, setShowAzimuthMetric] = useState<boolean>(true);
  const [showElevationMetric, setShowElevationMetric] = useState<boolean>(true);
  const [showVibrationMetric, setShowVibrationMetric] = useState<boolean>(false);

  // Logging & Recording State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [currentSamples, setCurrentSamples] = useState<AlignmentSample[]>([]);
  const [sessions, setSessions] = useState<AlignmentSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<AlignmentSession | null>(null);
  const [sessionNotes, setSessionNotes] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastBeepRef = useRef<number>(0);

  // Load saved sessions from localStorage on mount
  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SESSIONS);
      if (raw) {
        setSessions(JSON.parse(raw));
      }
    } catch (e) {
      console.warn('Failed to load alignment sessions', e);
    }
  }, []);

  // Persist sessions
  const persistSessions = (updated: AlignmentSession[]) => {
    setSessions(updated);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save alignment sessions', e);
      }
    }
  };

  // Stability calculation based on recent acceleration variance and delta from target
  const azDelta = Math.abs(((azimuth - targetAzimuth + 540) % 360) - 180);
  const elDelta = Math.abs(elevation - targetElevation);
  const stabilityScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(100 - azDelta * 15 - elDelta * 20 - Math.abs(accelMag - 9.81) * 8)
    )
  );

  // Optimal orientation threshold (within 0.5 degrees of target)
  const OPTIMAL_TOLERANCE_DEG = 0.5;
  const isOptimalOrientation = azDelta <= OPTIMAL_TOLERANCE_DEG && elDelta <= OPTIMAL_TOLERANCE_DEG;
  const isNearOptimalOrientation = azDelta <= 1.0 && elDelta <= 1.0;

  // Haptic feedback states & refs
  const [hapticEnabled, setHapticEnabled] = useState<boolean>(true);
  const [hapticPulseActive, setHapticPulseActive] = useState<boolean>(false);
  const lastHapticRef = useRef<number>(0);
  const wasOptimalRef = useRef<boolean>(false);

  // Haptic feedback trigger using navigator.vibrate
  const triggerHaptic = useCallback((pattern: number | number[] = [70, 40, 70]) => {
    if (!hapticEnabled) return false;
    let didVibrate = false;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        didVibrate = navigator.vibrate(pattern);
      } catch {
        didVibrate = false;
      }
    }
    // Visual tactile pulse indicator for UI feedback (useful on all platforms)
    setHapticPulseActive(true);
    setTimeout(() => setHapticPulseActive(false), 240);
    return didVibrate;
  }, [hapticEnabled]);

  // Web Audio Beep on high stability
  const playBeep = useCallback((freq = 900, duration = 0.05) => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtxRef.current.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtxRef.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      osc.start();
      osc.stop(audioCtxRef.current.currentTime + duration);
    } catch {
      // Ignore audio error
    }
  }, [soundEnabled]);

  // Haptic feedback effect: Triggers when the antenna reaches optimal orientation (within 0.5 degrees)
  useEffect(() => {
    if (!hapticEnabled) return;

    const now = Date.now();

    if (isOptimalOrientation) {
      // Optimal alignment reached (<= 0.5 deg error on both azimuth and elevation)
      // Provide an immediate crisp double-pulse on entry, and periodic pulse every 500ms while held in target
      if (!wasOptimalRef.current || now - lastHapticRef.current > 500) {
        triggerHaptic([70, 40, 70]);
        if (soundEnabled) {
          playBeep(1400, 0.08);
        }
        lastHapticRef.current = now;
      }
      wasOptimalRef.current = true;
    } else if (isNearOptimalOrientation && !wasOptimalRef.current) {
      // Approaching vicinity (<= 1.0 deg) - light touch pulse
      if (now - lastHapticRef.current > 700) {
        triggerHaptic(30);
        lastHapticRef.current = now;
      }
      wasOptimalRef.current = false;
    } else {
      wasOptimalRef.current = false;
    }
  }, [isOptimalOrientation, isNearOptimalOrientation, hapticEnabled, soundEnabled, triggerHaptic, playBeep]);

  // General recording beep
  useEffect(() => {
    if (isRecording && stabilityScore >= 85 && !isOptimalOrientation) {
      const now = Date.now();
      if (now - lastBeepRef.current > 500) {
        playBeep(1100, 0.06);
        lastBeepRef.current = now;
      }
    }
  }, [isRecording, stabilityScore, isOptimalOrientation, playBeep]);

  // Device orientation & motion listeners (Gyroscope + Accelerometer)
  useEffect(() => {
    if (useSimulation) return;

    let isMounted = true;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (!isMounted) return;
      let heading = (e as any).webkitCompassHeading;
      if (heading === undefined || heading === null) {
        if (e.alpha !== null) heading = 360 - e.alpha;
      }
      if (heading !== undefined && heading !== null && !isNaN(heading)) {
        setAzimuth(parseFloat(heading.toFixed(2)));
        setIsSensorActive(true);
      }
      if (e.beta !== null && !isNaN(e.beta)) {
        const pitch = parseFloat((e.beta - 90).toFixed(2));
        setElevation(pitch);
      }
      if (e.gamma !== null && !isNaN(e.gamma)) {
        setRoll(parseFloat(e.gamma.toFixed(2)));
      }
    };

    const handleMotion = (e: DeviceMotionEvent) => {
      if (!isMounted) return;
      const acc = e.accelerationIncludingGravity;
      if (acc && acc.x !== null && acc.y !== null && acc.z !== null) {
        const mag = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
        setAccelMag(parseFloat(mag.toFixed(2)));
      }
    };

    const initSensors = async () => {
      if (typeof window !== 'undefined') {
        if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
          try {
            const res = await (DeviceOrientationEvent as any).requestPermission();
            if (res === 'granted') {
              window.addEventListener('deviceorientation', handleOrientation, true);
              window.addEventListener('devicemotion', handleMotion, true);
              setIsSensorActive(true);
            } else {
              setSensorError('Sensor permission denied. Using manual/simulation mode.');
              setUseSimulation(true);
            }
          } catch {
            setSensorError('Sensor initialization failed. Using simulation mode.');
            setUseSimulation(true);
          }
        } else if ('DeviceOrientationEvent' in window) {
          window.addEventListener('deviceorientation', handleOrientation, true);
          window.addEventListener('devicemotion', handleMotion, true);
          setIsSensorActive(true);
          setTimeout(() => {
            if (!isSensorActive && isMounted) {
              setSensorError('No hardware sensor data received. Simulation mode active.');
              setUseSimulation(true);
            }
          }, 2000);
        } else {
          setSensorError('Device orientation not supported. Simulation mode active.');
          setUseSimulation(true);
        }
      }
    };

    initSensors();

    return () => {
      isMounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('deviceorientation', handleOrientation, true);
        window.removeEventListener('devicemotion', handleMotion, true);
      }
    };
  }, [useSimulation, isSensorActive]);

  // Simulation tick when useSimulation is true
  useEffect(() => {
    if (!useSimulation) return;
    const timer = setInterval(() => {
      setAzimuth((prev) => parseFloat((targetAzimuth + (Math.random() * 1.6 - 0.8)).toFixed(2)));
      setElevation((prev) => parseFloat((targetElevation + (Math.random() * 0.4 - 0.2)).toFixed(2)));
      setRoll((prev) => parseFloat((Math.random() * 0.5 - 0.25).toFixed(2)));
      setAccelMag(9.81 + (Math.random() * 0.2 - 0.1));
    }, 400);
    return () => clearInterval(timer);
  }, [useSimulation, targetAzimuth, targetElevation]);

  // Recording timer loop
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      const sample: AlignmentSample = {
        id: 'samp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        timestamp: new Date().toISOString(),
        azimuth,
        elevation,
        roll,
        stabilityScore,
        accelerationMagnitude: accelMag,
      };
      setCurrentSamples((prev) => [...prev, sample]);
    }, 500);

    return () => clearInterval(interval);
  }, [isRecording, azimuth, elevation, roll, stabilityScore, accelMag]);

  // Real-time 30-Second Rolling Window Buffer Update (1 Hz)
  useEffect(() => {
    if (isChartPaused) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const rawAzDelta = ((azimuth - targetAzimuth + 540) % 360) - 180;
      const rawElDelta = elevation - targetElevation;
      const currentVibration = Math.abs(accelMag - 9.81);

      setTrendBuffer((prev) => {
        const nextTime = prev.length > 0 ? prev[prev.length - 1].timestamp + 1000 : now;
        const newPoint: RealtimeTelemetryPoint = {
          timeStr: 'now',
          timestamp: nextTime,
          stabilityScore,
          azimuthDelta: parseFloat(rawAzDelta.toFixed(2)),
          elevationDelta: parseFloat(rawElDelta.toFixed(2)),
          vibration: parseFloat(currentVibration.toFixed(2)),
          roll: parseFloat(roll.toFixed(2)),
        };

        const updated = [...prev.slice(1), newPoint];
        return updated.map((pt, idx, arr) => {
          const secondsAgo = arr.length - 1 - idx;
          return {
            ...pt,
            timeStr: secondsAgo === 0 ? 'now' : `-${secondsAgo}s`,
          };
        });
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [
    isChartPaused,
    azimuth,
    elevation,
    accelMag,
    roll,
    stabilityScore,
    targetAzimuth,
    targetElevation,
  ]);

  // 30s Trend Statistics
  const avg30sStability = useMemo(() => {
    if (trendBuffer.length === 0) return 0;
    const sum = trendBuffer.reduce((acc, p) => acc + p.stabilityScore, 0);
    return Math.round(sum / trendBuffer.length);
  }, [trendBuffer]);

  const peak30sStability = useMemo(() => {
    if (trendBuffer.length === 0) return 0;
    return Math.max(...trendBuffer.map((p) => p.stabilityScore));
  }, [trendBuffer]);

  const max30sVibration = useMemo(() => {
    if (trendBuffer.length === 0) return 0;
    return Math.max(...trendBuffer.map((p) => p.vibration));
  }, [trendBuffer]);

  const handleStartRecording = () => {
    setCurrentSamples([]);
    setIsRecording(true);
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    if (currentSamples.length === 0) return;

    const avgAz = currentSamples.reduce((acc, s) => acc + s.azimuth, 0) / currentSamples.length;
    const avgEl = currentSamples.reduce((acc, s) => acc + s.elevation, 0) / currentSamples.length;
    const peakStab = Math.max(...currentSamples.map((s) => s.stabilityScore));

    const newSession: AlignmentSession = {
      sessionId: 'sess_' + Date.now(),
      startTime: currentSamples[0].timestamp,
      endTime: new Date().toISOString(),
      targetAzimuth,
      targetElevation,
      samples: [...currentSamples],
      averageAzimuth: parseFloat(avgAz.toFixed(2)),
      averageElevation: parseFloat(avgEl.toFixed(2)),
      peakStability: peakStab,
      status: 'SAVED',
      notes: sessionNotes || `Antenna alignment session for ${siteName}`,
    };

    persistSessions([newSession, ...sessions]);
    setSelectedSession(newSession);
    setSessionNotes('');
    if (onSaveSession) onSaveSession(newSession);
  };

  const handleDeleteSession = (sessionId: string) => {
    const updated = sessions.filter((s) => s.sessionId !== sessionId);
    persistSessions(updated);
    if (selectedSession?.sessionId === sessionId) {
      setSelectedSession(null);
    }
  };

  return (
    <div
      className={`p-4 sm:p-6 rounded-2xl border shadow-xl space-y-6 ${
        sunlightMode
          ? 'bg-amber-50/90 text-neutral-900 border-amber-300'
          : 'bg-slate-900 text-slate-100 border-slate-800'
      }`}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-extrabold tracking-tight text-white flex items-center gap-2">
              <Compass className="w-5 h-5 text-cyan-400 animate-pulse" />
              AlignmentEngine™ Sensor & Data Logging HUD
            </h2>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                isSensorActive || useSimulation
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                  : 'bg-amber-950 text-amber-300 border border-amber-700'
              }`}
            >
              {useSimulation ? 'SIMULATION MODE' : isSensorActive ? 'SENSORS ACTIVE' : 'CONNECTING...'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {hopName} · Target Azimuth: <span className="font-mono text-cyan-400 font-bold">{targetAzimuth}°</span> · Target Tilt: <span className="font-mono text-emerald-400 font-bold">{targetElevation}°</span>
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={() => setUseSimulation(!useSimulation)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs transition-colors flex items-center gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>{useSimulation ? 'Use Hardware Sensors' : 'Switch to Simulation'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !hapticEnabled;
              setHapticEnabled(next);
              if (next) triggerHaptic([50, 30, 50]);
            }}
            className={`px-2 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 text-xs font-mono ${
              hapticEnabled
                ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-500'
            }`}
            title={hapticEnabled ? 'Haptic Feedback: Enabled (Vibrates at ≤0.5° Optimal Target)' : 'Haptic Feedback: Disabled'}
          >
            <Vibrate className={`w-3.5 h-3.5 ${hapticPulseActive ? 'animate-ping text-emerald-400' : ''}`} />
            <span className="hidden sm:inline text-[11px] font-bold">{hapticEnabled ? 'Haptics ON' : 'Haptics OFF'}</span>
          </button>
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title={soundEnabled ? 'Mute Alignment Sound' : 'Enable Alignment Sound'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>
        </div>
      </div>

      {sensorError && (
        <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800 text-amber-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{sensorError}</span>
        </div>
      )}

      {/* Main Grid: Visual HUD + Telemetry Meters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Visual Compass & Inclinometer Guidance HUD */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center space-y-6 relative overflow-hidden">
          {/* Stability Score Banner */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span className="text-slate-400">Signal Stability:</span>
              <span className={`font-bold ${stabilityScore >= 80 ? 'text-emerald-400' : stabilityScore >= 50 ? 'text-cyan-400' : 'text-amber-400'}`}>
                {stabilityScore}%
              </span>
            </div>
            <div className="text-slate-400">
              Vibration: <span className="text-white font-bold">{Math.abs(accelMag - 9.81).toFixed(2)} m/s²</span>
            </div>
          </div>

          {/* Compass & Tilt Target Circle */}
          <div
            className={`relative w-56 h-56 sm:w-64 sm:h-64 rounded-full border-4 bg-slate-900/90 flex items-center justify-center shadow-2xl mt-6 transition-all duration-200 ${
              isOptimalOrientation
                ? 'border-emerald-400 shadow-emerald-950/80 ring-4 ring-emerald-500/30'
                : 'border-slate-800 shadow-slate-950/70'
            }`}
          >
            {/* Visual Haptic Pulse Ring when vibration triggers */}
            {hapticPulseActive && (
              <div className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping pointer-events-none opacity-60" />
            )}

            {/* Optimal Orientation (≤0.5°) Haptic Lock Badge */}
            {isOptimalOrientation && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-emerald-950/95 border border-emerald-500 text-emerald-300 text-[10px] font-mono font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950/70 z-20 animate-bounce">
                <Vibrate className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>HAPTIC LOCK (≤ 0.5°)</span>
              </div>
            )}

            {/* Target Ring Sector (±1°) */}
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ transform: `rotate(${targetAzimuth}deg)` }}
            >
              <div className="w-2.5 h-28 bg-emerald-500/35 rounded-t-full mb-28 border-x border-emerald-400" />
              <span className="absolute top-5 text-[10px] font-mono font-bold text-emerald-400 bg-slate-950/90 px-1 rounded border border-emerald-800/80">
                TARGET {targetAzimuth}°
              </span>
            </div>

            {/* Current Device Heading Needle */}
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-100"
              style={{ transform: `rotate(${azimuth}deg)` }}
            >
              <div
                className={`w-1.5 h-28 mb-28 rounded-t-full shadow-lg transition-colors ${
                  isOptimalOrientation
                    ? 'bg-emerald-300 shadow-emerald-400/90 w-2 animate-pulse'
                    : azDelta <= 1.0
                    ? 'bg-emerald-400 shadow-emerald-400/80'
                    : 'bg-cyan-400 shadow-cyan-400/60'
                }`}
              />
            </div>

            {/* Inclinometer Bubble Center */}
            <div
              className={`relative w-16 h-16 rounded-full border-2 flex flex-col items-center justify-center shadow-inner transition-colors ${
                isOptimalOrientation
                  ? 'border-emerald-400 bg-emerald-950/90 text-emerald-300'
                  : 'border-slate-700 bg-slate-950 text-white'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full shadow-md transition-transform duration-100 ${
                  isOptimalOrientation ? 'bg-emerald-300 shadow-emerald-400/80' : 'bg-cyan-400'
                }`}
                style={{
                  transform: `translate(${Math.max(-20, Math.min(20, azDelta * 5))}px, ${Math.max(
                    -20,
                    Math.min(20, -elDelta * 20)
                  )}px)`,
                }}
              />
              <span className="absolute text-[9px] font-mono font-bold z-10">
                {isOptimalOrientation ? '≤0.5°' : `${elevation.toFixed(1)}°`}
              </span>
            </div>
          </div>

          {/* Readouts */}
          <div className="grid grid-cols-3 gap-3 w-full">
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-center font-mono">
              <span className="text-[10px] text-slate-400 block uppercase">Azimuth</span>
              <span className="text-lg font-extrabold text-white">{azimuth}°</span>
              <p className="text-[10px] text-slate-500">Δ {azDelta.toFixed(1)}°</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-center font-mono">
              <span className="text-[10px] text-slate-400 block uppercase">Elevation Tilt</span>
              <span className="text-lg font-extrabold text-white">{elevation}°</span>
              <p className="text-[10px] text-slate-500">Δ {elDelta.toFixed(1)}°</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-center font-mono">
              <span className="text-[10px] text-slate-400 block uppercase">Roll Stability</span>
              <span className="text-lg font-extrabold text-white">{roll}°</span>
              <p className="text-[10px] text-slate-500">Level: ±0.5°</p>
            </div>
          </div>

          {/* Manual Simulation & Haptic Test Controls */}
          {useSimulation && (
            <div className="w-full p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-3 mt-2">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5 font-mono">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  Manual Sensor Simulation & Haptics Calibration
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAzimuth(targetAzimuth);
                      setElevation(targetElevation);
                      triggerHaptic([70, 40, 70]);
                    }}
                    className="px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 hover:bg-emerald-900 text-[10px] font-mono font-bold flex items-center gap-1"
                  >
                    <Vibrate className="w-3 h-3 text-emerald-400" />
                    <span>Snap to Optimal Target (≤0.5°)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerHaptic([70, 40, 70])}
                    className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-[10px] font-mono"
                  >
                    Test Vibration
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <div className="flex justify-between text-slate-400 font-mono mb-1 text-[11px]">
                    <span>Azimuth Adjustment (Target: {targetAzimuth}°):</span>
                    <span className="text-white font-bold">{azimuth.toFixed(2)}° (Δ {azDelta.toFixed(2)}°)</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="0.05"
                    value={azimuth}
                    onChange={(e) => setAzimuth(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 font-mono mb-1 text-[11px]">
                    <span>Elevation Tilt Adjustment (Target: {targetElevation}°):</span>
                    <span className="text-white font-bold">{elevation.toFixed(2)}° (Δ {elDelta.toFixed(2)}°)</span>
                  </div>
                  <input
                    type="range"
                    min="-5"
                    max="5"
                    step="0.05"
                    value={elevation}
                    onChange={(e) => setElevation(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Data Logging & Session Control */}
        <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              Alignment Session Data Logger
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Record live sensor telemetry during antenna sweeping and mast torquing to verify stable bore-sight lock-on for TSSR audit compliance.
            </p>

            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Recording Status:</span>
                <span className={`font-bold ${isRecording ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`}>
                  {isRecording ? '● LIVE RECORDING' : 'IDLE'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Samples Captured:</span>
                <span className="text-white font-bold">{currentSamples.length} samples</span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                Technician Session Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Mast tightened to 48 N·m, azimuth locked."
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                disabled={isRecording}
                className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            {!isRecording ? (
              <button
                type="button"
                onClick={handleStartRecording}
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Start Alignment Logging Session</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopRecording}
                className="w-full py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50 animate-pulse"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>Stop & Save Session Log</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* REAL-TIME 30-SECOND STABILIZATION TREND RECHARTS LINE GRAPH */}
      {/* ========================================================================= */}
      <div className="p-4 sm:p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
        {/* Graph Header: Title, Live Stats, and Controls */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-700 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold tracking-tight text-white flex items-center gap-1.5 font-mono">
                  30-Second Stabilization Trend
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800 flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${isChartPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-ping'}`} />
                  {isChartPaused ? 'PAUSED' : 'LIVE 1 Hz'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Rolling accelerometer & gyroscope stabilization dynamics showing mast vibration dampening and bore-sight stability.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              type="button"
              onClick={() => setIsChartPaused(!isChartPaused)}
              className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px] flex items-center gap-1.5 transition-colors"
            >
              {isChartPaused ? (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                  <span>Resume Stream</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>Pause Stream</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setTrendBuffer(generateInitial30sBuffer(targetAzimuth, targetElevation))}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Reset 30s Telemetry Buffer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 30s Trend Statistics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block font-sans font-semibold">
              30s Avg Stability
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`text-base font-extrabold ${avg30sStability >= 85 ? 'text-emerald-400' : 'text-cyan-400'}`}>
                {avg30sStability}%
              </span>
              <span className="text-[10px] text-slate-500">
                {avg30sStability >= 85 ? '(Aligned)' : '(Adjusting)'}
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block font-sans font-semibold">
              30s Peak Stability
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-extrabold text-emerald-400">
                {peak30sStability}%
              </span>
              <span className="text-[10px] text-slate-500">Target: 90%+</span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block font-sans font-semibold">
              Peak Mast Vibration
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-extrabold text-purple-400">
                {max30sVibration.toFixed(2)} m/s²
              </span>
              <span className="text-[10px] text-slate-500">Max &lt; 0.25</span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block font-sans font-semibold">
              Lock-On Status
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              {stabilityScore >= 85 ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-400">BORESIGHT LOCKED</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-amber-400">COARSE SWEEP</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Metric Toggles & Reference Line Info */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 select-none">
              <input
                type="checkbox"
                checked={showStabilityMetric}
                onChange={(e) => setShowStabilityMetric(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0 w-3.5 h-3.5"
              />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
              <span>Stability Score (%)</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 select-none">
              <input
                type="checkbox"
                checked={showAzimuthMetric}
                onChange={(e) => setShowAzimuthMetric(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0 w-3.5 h-3.5"
              />
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
              <span>Azimuth Error (°)</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 select-none">
              <input
                type="checkbox"
                checked={showElevationMetric}
                onChange={(e) => setShowElevationMetric(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0 w-3.5 h-3.5"
              />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
              <span>Tilt Error (°)</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 select-none">
              <input
                type="checkbox"
                checked={showVibrationMetric}
                onChange={(e) => setShowVibrationMetric(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-purple-500 focus:ring-0 w-3.5 h-3.5"
              />
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block" />
              <span>Vibration (m/s²)</span>
            </label>
          </div>

          <div className="text-[11px] font-mono text-slate-500">
            Window: -30s to 0s · Sample Rate: 1.0s
          </div>
        </div>

        {/* Recharts Composed Line & Area Graph */}
        <div className="w-full h-64 sm:h-72 pt-2 bg-slate-900/60 rounded-xl border border-slate-800 p-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trendBuffer} margin={{ top: 12, right: 16, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="stabilityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />

              <XAxis
                dataKey="timeStr"
                stroke="#64748b"
                tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'monospace' }}
                interval={4}
              />

              {/* Primary Y-Axis for Stability Percentage (0-100%) */}
              <YAxis
                yAxisId="stability"
                domain={[0, 100]}
                stroke="#10b981"
                tick={{ fontSize: 10, fill: '#34d399', fontFamily: 'monospace' }}
                tickFormatter={(val) => `${val}%`}
              />

              {/* Secondary Y-Axis for Angular Deltas and Vibration (-5 to +5) */}
              <YAxis
                yAxisId="delta"
                orientation="right"
                domain={[-4, 4]}
                stroke="#06b6d4"
                tick={{ fontSize: 10, fill: '#38bdf8', fontFamily: 'monospace' }}
                tickFormatter={(val) => `${val > 0 ? `+${val}` : val}°`}
              />

              <Tooltip content={<AlignmentTrendTooltip />} />

              {/* Optimal Target Lock Line (90%) */}
              <ReferenceLine
                yAxisId="stability"
                y={90}
                stroke="#10b981"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{ value: 'Lock Threshold (90%)', fill: '#34d399', fontSize: 10, position: 'insideTopLeft' }}
              />

              {/* Zero Delta Line */}
              <ReferenceLine
                yAxisId="delta"
                y={0}
                stroke="#64748b"
                strokeDasharray="2 2"
                strokeWidth={1}
              />

              {/* Stability Score Area & Line */}
              {showStabilityMetric && (
                <>
                  <Area
                    yAxisId="stability"
                    type="monotone"
                    dataKey="stabilityScore"
                    name="Stability"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#stabilityGrad)"
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="stability"
                    type="monotone"
                    dataKey="stabilityScore"
                    name="Stability"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </>
              )}

              {/* Azimuth Delta Line */}
              {showAzimuthMetric && (
                <Line
                  yAxisId="delta"
                  type="monotone"
                  dataKey="azimuthDelta"
                  name="Azimuth Error"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              )}

              {/* Elevation Delta Line */}
              {showElevationMetric && (
                <Line
                  yAxisId="delta"
                  type="monotone"
                  dataKey="elevationDelta"
                  name="Tilt Error"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              )}

              {/* Vibration Line */}
              {showVibrationMetric && (
                <Line
                  yAxisId="delta"
                  type="monotone"
                  dataKey="vibration"
                  name="Vibration"
                  stroke="#c084fc"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  dot={false}
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Session Log History & Export Table */}
      {sessions.length > 0 && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Saved Alignment Logs ({sessions.length})
            </h3>
            <span className="text-[11px] text-slate-400">Persisted in IndexedDB / Local Cache</span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {sessions.map((sess) => (
              <div
                key={sess.sessionId}
                className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-bold text-cyan-400">{new Date(sess.startTime).toLocaleString()}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                      {sess.samples.length} samples
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">{sess.notes}</p>
                  <p className="text-[10px] font-mono text-slate-400 mt-1">
                    Avg Az: <span className="text-white font-bold">{sess.averageAzimuth}°</span> · Avg Tilt: <span className="text-white font-bold">{sess.averageElevation}°</span> · Peak Stability: <span className="text-emerald-400 font-bold">{sess.peakStability}%</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sess, null, 2));
                      const downloadAnchor = document.createElement('a');
                      downloadAnchor.setAttribute("href", dataStr);
                      downloadAnchor.setAttribute("download", `alignment_${sess.sessionId}.json`);
                      document.body.appendChild(downloadAnchor);
                      downloadAnchor.click();
                      downloadAnchor.remove();
                    }}
                    className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px] flex items-center gap-1 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Export JSON</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSession(sess.sessionId)}
                    className="p-1.5 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 transition-colors"
                    title="Delete Session Log"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
