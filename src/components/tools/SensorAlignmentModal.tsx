import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Compass,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Volume2,
  VolumeX,
  Vibrate,
  ShieldCheck,
  X,
  Crosshair,
  Sliders,
  Smartphone,
  Navigation,
} from 'lucide-react';

interface SensorAlignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetAzimuth?: number; // e.g. 241.02
  targetElevation?: number; // e.g. 0.12
  siteName?: string;
  hopName?: string;
  onSaveAlignment?: (azimuth: number, elevation: number) => void;
  sunlightMode?: boolean;
}

export const SensorAlignmentModal: React.FC<SensorAlignmentModalProps> = ({
  isOpen,
  onClose,
  targetAzimuth = 241.02,
  targetElevation = 0.12,
  siteName = 'Site B (Catangnan)',
  hopName = 'NS-TER25-A062 to NS-TER25-A035',
  onSaveAlignment,
  sunlightMode = false,
}) => {
  // Sensor State
  const [currentAzimuth, setCurrentAzimuth] = useState<number>(238.5);
  const [currentElevation, setCurrentElevation] = useState<number>(0.0);
  const [sensorActive, setSensorActive] = useState<boolean>(false);
  const [sensorError, setSensorError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [manualMode, setManualMode] = useState<boolean>(false);

  // Audio Context Ref for alignment feedback
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastBeepTimeRef = useRef<number>(0);

  // Calculate Deltas
  const azimuthDelta = ((currentAzimuth - targetAzimuth + 540) % 360) - 180;
  const elevationDelta = currentElevation - targetElevation;

  const isAzimuthAligned = Math.abs(azimuthDelta) <= 1.0;
  const isElevationAligned = Math.abs(elevationDelta) <= 0.5;
  const isFullyAligned = isAzimuthAligned && isElevationAligned;

  // Sound generator using Web Audio API
  const playAlignmentBeep = useCallback((freq = 880, duration = 0.08) => {
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
      gain.gain.setValueAtTime(0.15, audioCtxRef.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      osc.start();
      osc.stop(audioCtxRef.current.currentTime + duration);
    } catch {
      // Audio context error ignore
    }
  }, [soundEnabled]);

  // Haptic feedback
  const triggerHaptic = useCallback(() => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(60);
      } catch {
        // Ignore vibration error
      }
    }
  }, []);

  // Beep when alignment approaches or locks
  useEffect(() => {
    if (!isOpen) return;
    const now = Date.now();
    if (isFullyAligned) {
      if (now - lastBeepTimeRef.current > 350) {
        playAlignmentBeep(1200, 0.12);
        triggerHaptic();
        lastBeepTimeRef.current = now;
      }
    } else if (Math.abs(azimuthDelta) <= 3.0) {
      if (now - lastBeepTimeRef.current > 800) {
        playAlignmentBeep(660, 0.06);
        lastBeepTimeRef.current = now;
      }
    }
  }, [isOpen, isFullyAligned, azimuthDelta, playAlignmentBeep, triggerHaptic]);

  // Initialize and listen to device orientation sensors
  useEffect(() => {
    if (!isOpen || manualMode) return;

    let isMounted = true;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (!isMounted) return;

      // Handle iOS Safari webkitCompassHeading (true magnetic heading)
      let heading = (event as any).webkitCompassHeading;

      if (heading === undefined || heading === null) {
        // Fallback for Android Chrome
        if (event.alpha !== null) {
          heading = 360 - event.alpha;
        }
      }

      if (heading !== undefined && heading !== null && !isNaN(heading)) {
        setCurrentAzimuth(parseFloat(heading.toFixed(1)));
        setSensorActive(true);
        setSensorError(null);
      }

      // Elevation pitch tilt (beta: -90 to +90)
      if (event.beta !== null && !isNaN(event.beta)) {
        // Normalize phone held perpendicular against dish backplate
        const pitch = parseFloat((event.beta - 90).toFixed(1));
        setCurrentElevation(pitch);
      }
    };

    // Request permissions for iOS 13+ devices
    const initSensors = async () => {
      if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
        if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
          try {
            const permissionState = await (DeviceOrientationEvent as any).requestPermission();
            if (permissionState === 'granted') {
              window.addEventListener('deviceorientation', handleOrientation, true);
              setSensorActive(true);
            } else {
              setSensorError('Device orientation permission was denied. Switched to manual alignment simulation.');
              setManualMode(true);
            }
          } catch (e: any) {
            setSensorError('Permission request error. Switched to manual simulation.');
            setManualMode(true);
          }
        } else {
          // Standard browser implementation (Android Chrome / Desktop)
          window.addEventListener('deviceorientation', handleOrientation, true);
          // Set a timeout to switch to manual mode if no orientation events fire (e.g. desktop)
          const timeout = setTimeout(() => {
            if (!sensorActive && isMounted) {
              setSensorError('No hardware magnetometer detected on this device. Manual simulation mode enabled.');
              setManualMode(true);
            }
          }, 1500);
          return () => clearTimeout(timeout);
        }
      } else {
        setSensorError('Device orientation API not supported on this platform. Manual simulation mode enabled.');
        setManualMode(true);
      }
    };

    initSensors();

    return () => {
      isMounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('deviceorientation', handleOrientation, true);
      }
    };
  }, [isOpen, manualMode, sensorActive]);

  if (!isOpen) return null;

  const handleApply = () => {
    if (onSaveAlignment) {
      onSaveAlignment(currentAzimuth, currentElevation);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div
        className={`w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border ${
          sunlightMode
            ? 'bg-amber-50 text-neutral-900 border-amber-400'
            : 'bg-slate-900 text-slate-100 border-slate-800'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg transition-colors ${
                isFullyAligned
                  ? 'bg-emerald-600 shadow-emerald-950/50'
                  : 'bg-gradient-to-br from-cyan-600 to-blue-700 shadow-cyan-950/50'
              }`}
            >
              <Compass className={`w-5 h-5 ${isFullyAligned ? 'animate-bounce' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-tight text-white">
                  Real-Time Antenna Sensor Alignment
                </h2>
                {isFullyAligned ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-700 animate-pulse">
                    LOCKED ON
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                    ALIGNING
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {hopName} · Target: {targetAzimuth.toFixed(1)}° Azimuth / {targetElevation >= 0 ? `+${targetElevation.toFixed(1)}` : targetElevation.toFixed(1)}° Tilt
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={soundEnabled ? 'Mute Alignment Audio' : 'Enable Alignment Audio'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Status Message / Hardware Notification */}
          {sensorError && (
            <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/80 text-amber-300 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{sensorError}</span>
              </div>
              <button
                onClick={() => setManualMode(!manualMode)}
                className="px-2 py-1 rounded bg-amber-900 hover:bg-amber-800 text-white font-mono text-[10px] uppercase font-bold shrink-0"
              >
                {manualMode ? 'Use Hardware' : 'Manual Sliders'}
              </button>
            </div>
          )}

          {/* Dual Ring HUD Dial */}
          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-950 border border-slate-800 relative">
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-full border-4 border-slate-800 bg-slate-900/90 flex items-center justify-center shadow-2xl overflow-hidden">
              {/* Outer Heading Compass Degree Marks */}
              <div className="absolute inset-2 rounded-full border border-slate-800 pointer-events-none flex items-center justify-center">
                <span className="absolute top-1 text-[11px] font-mono font-bold text-slate-400">N (000°)</span>
                <span className="absolute right-2 text-[11px] font-mono font-bold text-slate-400">E (090°)</span>
                <span className="absolute bottom-1 text-[11px] font-mono font-bold text-slate-400">S (180°)</span>
                <span className="absolute left-2 text-[11px] font-mono font-bold text-slate-400">W (270°)</span>
              </div>

              {/* Green Target Tolerance Wedge (±1.0°) */}
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{ transform: `rotate(${targetAzimuth}deg)` }}
              >
                <div className="w-2.5 h-32 bg-emerald-500/30 rounded-t-full mb-32 border-x border-emerald-400/80 shadow-lg shadow-emerald-500/20" />
                <span className="absolute top-7 text-[10px] font-mono font-bold text-emerald-400 px-1 bg-slate-950/80 rounded border border-emerald-800">
                  TARGET {targetAzimuth.toFixed(1)}°
                </span>
              </div>

              {/* Antenna Aim Direction Needle */}
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-100 ease-out"
                style={{ transform: `rotate(${currentAzimuth}deg)` }}
              >
                <div
                  className={`w-2 h-32 mb-32 rounded-t-full shadow-lg ${
                    isAzimuthAligned
                      ? 'bg-emerald-400 shadow-emerald-400/80 animate-pulse'
                      : Math.abs(azimuthDelta) <= 3.0
                      ? 'bg-cyan-400 shadow-cyan-400/60'
                      : 'bg-rose-500 shadow-rose-500/60'
                  }`}
                />
              </div>

              {/* Inclinometer Tilt Bubble Center Indicator */}
              <div
                className={`relative w-20 h-20 rounded-full border-2 flex flex-col items-center justify-center transition-colors shadow-inner ${
                  isFullyAligned
                    ? 'border-emerald-400 bg-emerald-950/60 text-emerald-300'
                    : 'border-slate-700 bg-slate-950/80 text-white'
                }`}
              >
                {/* Crosshairs */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-full h-px bg-slate-700" />
                  <div className="h-full w-px bg-slate-700 absolute" />
                </div>

                {/* Tilt Pitch Bubble */}
                <div
                  className="w-4 h-4 rounded-full bg-cyan-400 shadow-md transition-transform duration-100"
                  style={{
                    transform: `translate(${Math.max(-24, Math.min(24, azimuthDelta * 4))}px, ${Math.max(
                      -24,
                      Math.min(24, -elevationDelta * 12)
                    )}px)`,
                  }}
                />

                <span className="text-[10px] font-mono font-bold mt-1 z-10">
                  {currentAzimuth.toFixed(1)}°
                </span>
              </div>
            </div>

            {/* Readout Badges */}
            <div className="mt-4 grid grid-cols-2 gap-3 w-full max-w-md">
              <div
                className={`p-3 rounded-lg border text-center font-mono ${
                  isAzimuthAligned
                    ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-200'
                }`}
              >
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Current Azimuth
                </span>
                <span className="text-xl font-bold">{currentAzimuth.toFixed(1)}°</span>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Δ {azimuthDelta > 0 ? `+${azimuthDelta.toFixed(1)}°` : `${azimuthDelta.toFixed(1)}°`} (Aim {azimuthDelta > 0 ? 'Left' : 'Right'})
                </p>
              </div>

              <div
                className={`p-3 rounded-lg border text-center font-mono ${
                  isElevationAligned
                    ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-200'
                }`}
              >
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Elevation Tilt
                </span>
                <span className="text-xl font-bold">
                  {currentElevation >= 0 ? `+${currentElevation.toFixed(1)}°` : `${currentElevation.toFixed(1)}°`}
                </span>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Δ {elevationDelta > 0 ? `+${elevationDelta.toFixed(1)}°` : `${elevationDelta.toFixed(1)}°`} ({elevationDelta > 0 ? 'Tilt Down' : 'Tilt Up'})
                </p>
              </div>
            </div>
          </div>

          {/* Manual Simulation Controls */}
          {manualMode && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5 font-mono">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  Manual Sensor Simulation Controls
                </span>
                <button
                  onClick={() => {
                    setCurrentAzimuth(targetAzimuth);
                    setCurrentElevation(targetElevation);
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800 hover:bg-cyan-900"
                >
                  Snap to Target
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <div className="flex justify-between text-slate-400 font-mono mb-1">
                    <span>Azimuth Slider:</span>
                    <span className="text-white font-bold">{currentAzimuth.toFixed(1)}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="0.1"
                    value={currentAzimuth}
                    onChange={(e) => setCurrentAzimuth(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 font-mono mb-1">
                    <span>Elevation Pitch Slider:</span>
                    <span className="text-white font-bold">
                      {currentElevation >= 0 ? `+${currentElevation.toFixed(1)}°` : `${currentElevation.toFixed(1)}°`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-10"
                    max="10"
                    step="0.1"
                    value={currentElevation}
                    onChange={(e) => setCurrentElevation(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Rigging Guidance Instructions */}
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300 space-y-1.5 leading-relaxed">
            <span className="font-bold text-cyan-400 block font-mono">Tower Alignment Procedure:</span>
            <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
              <li>Place mobile smartphone flat against antenna rear mount collar or feedhorn spar.</li>
              <li>Loosen fine azimuth adjustment screw locknuts on the mast pipe clamp.</li>
              <li>Slowly pan antenna horizontally until azimuth dial needle locks into green wedge.</li>
              <li>Adjust elevation turnbuckle until center tilt bubble is centered.</li>
              <li>Torque clamp bolts to 45–50 N·m sequentially to preserve bore-sight link alignment.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 px-5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
            {isFullyAligned ? (
              <span className="text-emerald-400 flex items-center gap-1 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Link Bore-Sight Aligned
              </span>
            ) : (
              <span>Fine Adjustment Required</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className={`px-4 py-1.5 rounded-lg font-mono text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
                isFullyAligned
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-950/50'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Apply Alignment Data</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
