import {
  DeviceBatteryState,
  DeviceBatteryLogPoint,
  DeviceBatteryAlertLevel,
} from '../types/fieldops';

const STORAGE_KEY_BATTERY_CONFIG = 'fieldops_device_battery_config';
const STORAGE_KEY_BATTERY_HISTORY = 'fieldops_device_battery_history';

// BatteryManager spec interface
interface WebBatteryManager extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
  addEventListener(
    type: 'chargingchange' | 'chargingtimechange' | 'dischargingtimechange' | 'levelchange',
    listener: (this: WebBatteryManager, ev: Event) => any,
    options?: boolean | AddEventListenerOptions
  ): void;
  removeEventListener(
    type: 'chargingchange' | 'chargingtimechange' | 'dischargingtimechange' | 'levelchange',
    listener: (this: WebBatteryManager, ev: Event) => any,
    options?: boolean | EventListenerOptions
  ): void;
}

class DeviceBatteryService {
  private batteryManager: WebBatteryManager | null = null;
  private listeners: Set<(state: DeviceBatteryState) => void> = new Set();
  private history: DeviceBatteryLogPoint[] = [];
  private audioCtx: AudioContext | null = null;

  // Configuration thresholds
  private warningThreshold = 25; // %
  private criticalThreshold = 15; // %
  private emergencyThreshold = 8; // %

  // Simulation mode
  private isSimulated = false;
  private simulatedLevel = 76; // %
  private simulatedCharging = false;
  private simulatedDischargeRate = -14.2; // %/hr
  private simulatedTemp = 31.4; // °C

  // Real device state
  private currentLevel = 85;
  private isCharging = false;
  private chargingTime: number | null = null;
  private dischargingTime: number | null = null;
  private isSupported = false;

  // Rate tracking
  private lastLevelCheckTime = Date.now();
  private lastLevelValue = 85;
  private dischargeRatePerHour = -12.5; // Smoothed %/hr
  private simulationInterval: any = null;

  constructor() {
    this.loadConfig();
    this.loadHistory();
    this.initWebBattery();
  }

  private loadConfig() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_BATTERY_CONFIG);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.warningThreshold === 'number') this.warningThreshold = parsed.warningThreshold;
        if (typeof parsed.criticalThreshold === 'number') this.criticalThreshold = parsed.criticalThreshold;
        if (typeof parsed.emergencyThreshold === 'number') this.emergencyThreshold = parsed.emergencyThreshold;
        if (typeof parsed.isSimulated === 'boolean') this.isSimulated = parsed.isSimulated;
        if (typeof parsed.simulatedLevel === 'number') this.simulatedLevel = parsed.simulatedLevel;
      }
    } catch {
      // Ignore parse errors
    }
  }

  private saveConfig() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(
        STORAGE_KEY_BATTERY_CONFIG,
        JSON.stringify({
          warningThreshold: this.warningThreshold,
          criticalThreshold: this.criticalThreshold,
          emergencyThreshold: this.emergencyThreshold,
          isSimulated: this.isSimulated,
          simulatedLevel: this.simulatedLevel,
        })
      );
    } catch {
      // Ignore storage errors
    }
  }

  private loadHistory() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_BATTERY_HISTORY);
      if (raw) {
        this.history = JSON.parse(raw);
      }
    } catch {
      this.history = [];
    }

    if (this.history.length === 0) {
      this.seedInitialHistory();
    }
  }

  private saveHistory() {
    if (typeof localStorage === 'undefined') return;
    try {
      // Keep last 60 telemetry points
      const slice = this.history.slice(-60);
      localStorage.setItem(STORAGE_KEY_BATTERY_HISTORY, JSON.stringify(slice));
    } catch {
      // Ignore storage errors
    }
  }

  private seedInitialHistory() {
    const now = Date.now();
    const points: DeviceBatteryLogPoint[] = [];
    let currentPct = 94;

    for (let i = 24; i >= 0; i--) {
      const t = now - i * 60 * 1000 * 5; // Every 5 minutes over last 2 hours
      const drop = Math.random() * 0.7 + 0.3;
      currentPct = Math.max(10, currentPct - drop);
      const levelRound = parseFloat(currentPct.toFixed(1));
      const rate = -11.5 - Math.random() * 4.0;
      const alertLevel = this.computeAlertLevel(levelRound);

      points.push({
        timestamp: t,
        timeStr: new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        level: levelRound,
        dischargeRatePerHour: parseFloat(rate.toFixed(1)),
        charging: false,
        temperatureC: parseFloat((30.2 + (24 - i) * 0.12).toFixed(1)),
        alertLevel,
      });
    }

    this.history = points;
    this.saveHistory();
  }

  private async initWebBattery() {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      try {
        const bm = await (navigator as any).getBattery();
        this.batteryManager = bm;
        this.isSupported = true;
        this.syncFromBatteryManager();

        bm.addEventListener('levelchange', () => this.handleBatteryChange());
        bm.addEventListener('chargingchange', () => this.handleBatteryChange());
        bm.addEventListener('chargingtimechange', () => this.handleBatteryChange());
        bm.addEventListener('dischargingtimechange', () => this.handleBatteryChange());
      } catch (e) {
        console.warn('Web Battery API failed to initialize:', e);
        this.isSupported = false;
        this.isSimulated = true;
      }
    } else {
      this.isSupported = false;
      this.isSimulated = true;
    }

    this.startRateTracking();
    this.notify();
  }

  private syncFromBatteryManager() {
    if (!this.batteryManager) return;
    this.currentLevel = Math.round(this.batteryManager.level * 100);
    this.isCharging = this.batteryManager.charging;
    this.chargingTime = isFinite(this.batteryManager.chargingTime) ? this.batteryManager.chargingTime : null;
    this.dischargingTime = isFinite(this.batteryManager.dischargingTime)
      ? this.batteryManager.dischargingTime
      : null;
  }

  private handleBatteryChange() {
    if (this.isSimulated) return;
    this.syncFromBatteryManager();
    this.recordSample();
    this.notify();
  }

  private startRateTracking() {
    // Record telemetry point every 30 seconds
    setInterval(() => {
      this.recordSample();
      this.notify();
    }, 30000);
  }

  private recordSample() {
    const state = this.getState();
    const now = Date.now();
    const point: DeviceBatteryLogPoint = {
      timestamp: now,
      timeStr: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      level: state.level,
      dischargeRatePerHour: state.dischargeRatePerHour,
      charging: state.charging,
      temperatureC: state.temperatureC,
      alertLevel: state.alertLevel,
    };

    this.history.push(point);
    if (this.history.length > 120) {
      this.history.shift();
    }
    this.saveHistory();
  }

  private computeAlertLevel(level: number): DeviceBatteryAlertLevel {
    if (level <= this.emergencyThreshold) return 'EMERGENCY';
    if (level <= this.criticalThreshold) return 'CRITICAL';
    if (level <= this.warningThreshold) return 'ADVISORY';
    return 'NOMINAL';
  }

  public getState(): DeviceBatteryState {
    const level = this.isSimulated ? this.simulatedLevel : this.currentLevel;
    const charging = this.isSimulated ? this.simulatedCharging : this.isCharging;
    const alertLevel = this.computeAlertLevel(level);

    let dischargeRate = this.isSimulated ? this.simulatedDischargeRate : this.dischargeRatePerHour;
    if (charging) {
      dischargeRate = Math.abs(dischargeRate) * 1.5; // positive when charging
    }

    // Health status calculation
    let healthStatus: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL' = 'GOOD';
    let batteryHealthScore = 92;
    if (level < 10) {
      healthStatus = 'CRITICAL';
      batteryHealthScore = 68;
    } else if (level < 20) {
      healthStatus = 'POOR';
      batteryHealthScore = 78;
    } else if (level > 80) {
      healthStatus = 'EXCELLENT';
      batteryHealthScore = 97;
    }

    // Estimated minutes remaining based on rate
    let estimatedMinutesRemaining: number | null = null;
    if (!charging && dischargeRate < 0) {
      const hoursLeft = level / Math.abs(dischargeRate);
      estimatedMinutesRemaining = Math.max(1, Math.round(hoursLeft * 60));
    } else if (charging) {
      const pctNeeded = 100 - level;
      const hoursToFull = pctNeeded / Math.max(1, dischargeRate);
      estimatedMinutesRemaining = Math.round(hoursToFull * 60);
    }

    // Ambient / Battery Temperature estimate (outdoor tower heating)
    const baseTemp = 28.5;
    const heatFactor = charging ? 4.5 : Math.abs(dischargeRate) > 20 ? 3.8 : 1.5;
    const temperatureC = parseFloat((baseTemp + heatFactor + (this.isSimulated ? 0 : 0.8)).toFixed(1));

    return {
      level,
      charging,
      chargingTime: this.chargingTime,
      dischargingTime: this.dischargingTime,
      dischargeRatePerHour: parseFloat(dischargeRate.toFixed(1)),
      healthStatus,
      batteryHealthScore,
      estimatedMinutesRemaining,
      temperatureC,
      alertLevel,
      isSimulated: this.isSimulated,
      isSupported: this.isSupported,
      warningThreshold: this.warningThreshold,
      criticalThreshold: this.criticalThreshold,
      emergencyThreshold: this.emergencyThreshold,
    };
  }

  public subscribe(cb: (state: DeviceBatteryState) => void): () => void {
    this.listeners.add(cb);
    cb(this.getState());
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify() {
    const s = this.getState();
    this.listeners.forEach((fn) => fn(s));
  }

  // --- Controls & Simulation ---

  public setSimulationMode(enabled: boolean) {
    this.isSimulated = enabled;
    this.saveConfig();
    this.notify();
  }

  public setSimulatedLevel(level: number, charging = false, rate = -15.0) {
    this.isSimulated = true;
    this.simulatedLevel = Math.max(1, Math.min(100, Math.round(level)));
    this.simulatedCharging = charging;
    this.simulatedDischargeRate = rate;
    this.saveConfig();
    this.recordSample();
    this.notify();
  }

  public setThresholds(warning: number, critical: number, emergency: number) {
    this.warningThreshold = warning;
    this.criticalThreshold = critical;
    this.emergencyThreshold = emergency;
    this.saveConfig();
    this.notify();
  }

  public getHistory(): DeviceBatteryLogPoint[] {
    return [...this.history];
  }

  public clearHistory() {
    this.history = [];
    this.saveHistory();
    this.recordSample();
    this.notify();
  }

  // --- Haptic & Audio Feedback for Tower Technicians ---

  public triggerHapticAlert(alertLevel: DeviceBatteryAlertLevel) {
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return false;
    try {
      switch (alertLevel) {
        case 'EMERGENCY':
          return navigator.vibrate([150, 60, 150, 60, 300, 100, 300]);
        case 'CRITICAL':
          return navigator.vibrate([100, 60, 100, 60, 150]);
        case 'ADVISORY':
          return navigator.vibrate([60, 40, 60]);
        default:
          return navigator.vibrate(40);
      }
    } catch {
      return false;
    }
  }

  public triggerAudioAlert(alertLevel: DeviceBatteryAlertLevel) {
    if (typeof window === 'undefined') return;
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      if (alertLevel === 'EMERGENCY') {
        // High frequency dual warble
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1200, now + 0.1);
        osc.frequency.setValueAtTime(880, now + 0.2);
        osc.frequency.setValueAtTime(1200, now + 0.3);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      } else if (alertLevel === 'CRITICAL') {
        // Double warning chirp
        osc.type = 'sine';
        osc.frequency.setValueAtTime(750, now);
        osc.frequency.setValueAtTime(600, now + 0.1);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else {
        // Single gentle advisory tone
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      }
    } catch {
      // Audio autoplay restrictions or headless environment
    }
  }
}

export const deviceBatteryService = new DeviceBatteryService();
