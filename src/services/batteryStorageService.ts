import { BatteryTelemetryPoint } from '../types/fieldops';

const BATTERY_STORAGE_KEY = 'fieldops_battery_telemetry_cache';

class BatteryStorageService {
  private cache: Map<string, BatteryTelemetryPoint[]> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.hydrateFromStorage();
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  private hydrateFromStorage() {
    if (typeof localStorage === 'undefined') return;

    try {
      const raw = localStorage.getItem(BATTERY_STORAGE_KEY);
      if (raw) {
        const parsed: Record<string, BatteryTelemetryPoint[]> = JSON.parse(raw);
        Object.entries(parsed).forEach(([siteId, points]) => {
          this.cache.set(siteId, points);
        });
      }
    } catch (e) {
      console.warn('Failed to parse battery telemetry cache:', e);
    }
  }

  private persist() {
    if (typeof localStorage === 'undefined') return;

    try {
      const serialized: Record<string, BatteryTelemetryPoint[]> = {};
      this.cache.forEach((points, siteId) => {
        serialized[siteId] = points;
      });
      localStorage.setItem(BATTERY_STORAGE_KEY, JSON.stringify(serialized));
    } catch (e) {
      console.warn('Failed to persist battery cache:', e);
    }
  }

  /**
   * Generate realistic 24-hour battery discharge and recovery curve for a telecom site
   */
  public generate24hDischargeCurve(siteId: string): BatteryTelemetryPoint[] {
    const points: BatteryTelemetryPoint[] = [];
    const now = new Date();

    // Generate 25 points (hourly from 24h ago to present)
    for (let i = 24; i >= 0; i--) {
      const pointTime = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hoursAgo = i;
      const hoursStr = pointTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

      let voltage: number;
      let dischargeCurrentA: number;
      let stateOfChargePercent: number;
      let temperatureC: number;
      let gridStatus: 'AC_NORMAL' | 'GRID_OUTAGE' | 'GENSET_ONLINE' | 'FLOAT_CHARGE';
      let notes: string | undefined;

      if (hoursAgo >= 17) {
        // Normal Utility Operation (Float Charging)
        voltage = -53.6 + Math.round((Math.random() * 0.2 - 0.1) * 10) / 10;
        dischargeCurrentA = 1.8 + Math.round(Math.random() * 0.4 * 10) / 10; // Trickle charge
        stateOfChargePercent = 100;
        temperatureC = 27.5 + Math.round(Math.random() * 0.5 * 10) / 10;
        gridStatus = 'AC_NORMAL';
        if (hoursAgo === 24) notes = 'Normal Float Operation (-53.5V)';
      } else if (hoursAgo >= 9) {
        // Commercial Power Outage - Active Battery Bank Discharge
        const dischargeHour = 17 - hoursAgo; // 1 to 8 hours into outage
        gridStatus = 'GRID_OUTAGE';
        dischargeCurrentA = 24.5 + Math.round((Math.random() * 4.0 - 2.0) * 10) / 10;
        temperatureC = 29.0 + (dischargeHour * 0.5);

        // Standard LiFePO4 / AGM -48V Discharge Curve
        if (dischargeHour <= 2) {
          // Plateau start
          voltage = -50.8 - (dischargeHour * 0.7);
          stateOfChargePercent = 95 - (dischargeHour * 8);
          notes = 'Commercial Grid Lost: Discharge Commenced';
        } else if (dischargeHour <= 5) {
          // Nominal plateau
          voltage = -48.8 - ((dischargeHour - 2) * 0.6);
          stateOfChargePercent = 78 - ((dischargeHour - 2) * 12);
        } else if (dischargeHour <= 7) {
          // Knee point towards low voltage
          voltage = -46.5 - ((dischargeHour - 5) * 0.8);
          stateOfChargePercent = 42 - ((dischargeHour - 5) * 10);
          notes = 'Low Voltage Warning Threshold (-46.0V)';
        } else {
          // Deep discharge alert before cutoff
          voltage = -44.6;
          stateOfChargePercent = 21;
          notes = 'Critical Low Voltage: Deploying Emergency Genset';
        }
      } else if (hoursAgo >= 4) {
        // Emergency 5kVA Genset Activated - Bulk Battery Recharging
        const chargeHour = 9 - hoursAgo;
        gridStatus = 'GENSET_ONLINE';
        dischargeCurrentA = -26.0; // Negative indicates charging current
        temperatureC = 33.5 - (chargeHour * 0.4);
        voltage = -47.0 + (chargeHour * 1.2);
        stateOfChargePercent = 25 + (chargeHour * 14);
        if (hoursAgo === 8) notes = 'Genset Online: Bulk CC Charging Initiated';
      } else {
        // Commercial Grid Restored - Absorption & Float Charging
        const floatHour = 4 - hoursAgo;
        gridStatus = 'FLOAT_CHARGE';
        dischargeCurrentA = -8.0 + (floatHour * 1.5);
        voltage = Math.min(-53.5, -52.2 + (floatHour * 0.4));
        stateOfChargePercent = Math.min(100, 85 + (floatHour * 4));
        temperatureC = 28.5 - (floatHour * 0.2);
        if (hoursAgo === 3) notes = 'Commercial Grid Energized: Absorption Phase';
      }

      points.push({
        id: `batt_${siteId}_${pointTime.getTime()}`,
        siteId,
        timestamp: pointTime.toISOString(),
        timeLabel: hoursStr,
        hoursAgo,
        voltage: Math.round(voltage * 100) / 100,
        dischargeCurrentA: Math.round(dischargeCurrentA * 10) / 10,
        stateOfChargePercent: Math.round(stateOfChargePercent),
        temperatureC: Math.round(temperatureC * 10) / 10,
        gridStatus,
        notes,
      });
    }

    return points;
  }

  /**
   * Retrieve battery telemetry for site, generating or returning cached data
   */
  public getTelemetry(siteId: string, timeframeHours: number = 24): BatteryTelemetryPoint[] {
    let sitePoints = this.cache.get(siteId);

    if (!sitePoints || sitePoints.length === 0) {
      sitePoints = this.generate24hDischargeCurve(siteId);
      this.cache.set(siteId, sitePoints);
      this.persist();
    }

    if (timeframeHours < 24) {
      return sitePoints.filter((p) => p.hoursAgo <= timeframeHours);
    }

    return sitePoints;
  }

  /**
   * Append a live battery multimeter measurement into the historical cache
   */
  public recordLiveMeasurement(
    siteId: string,
    voltage: number,
    currentA: number = 18.2,
    soc: number = 88,
    tempC: number = 31.0
  ): BatteryTelemetryPoint {
    const existing = this.getTelemetry(siteId);
    const now = new Date();
    const newPoint: BatteryTelemetryPoint = {
      id: `batt_${siteId}_${now.getTime()}`,
      siteId,
      timestamp: now.toISOString(),
      timeLabel: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      hoursAgo: 0,
      voltage: Math.round(voltage * 100) / 100,
      dischargeCurrentA: currentA,
      stateOfChargePercent: soc,
      temperatureC: tempC,
      gridStatus: voltage < -46.5 ? 'GRID_OUTAGE' : 'AC_NORMAL',
      notes: `Live Multimeter Check: ${voltage}V DC`,
    };

    // Update latest point
    const updated = [...existing.filter((p) => p.hoursAgo > 0), newPoint];
    this.cache.set(siteId, updated);
    this.persist();
    this.notify();
    return newPoint;
  }

  /**
   * Reset / regenerate discharge test curve for simulation
   */
  public resetToStandardCurve(siteId: string) {
    const fresh = this.generate24hDischargeCurve(siteId);
    this.cache.set(siteId, fresh);
    this.persist();
    this.notify();
    return fresh;
  }
}

export const batteryStorage = new BatteryStorageService();
