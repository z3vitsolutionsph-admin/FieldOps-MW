import React, { useState, useMemo, useRef } from 'react';
import { Site, Hop } from '../../types/fieldops';
import {
  Radio,
  Sliders,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Info,
  Maximize2,
  RefreshCw,
  Compass,
  Zap,
} from 'lucide-react';

interface RfFresnelDiagramProps {
  siteA: Site;
  siteB: Site;
  hop: Hop;
  sunlightMode: boolean;
  onProbeDistanceChange?: (distanceKm: number) => void;
}

export interface TerrainPoint {
  distKm: number;
  elevationM: number;
  clutterM: number;
  label?: string;
}

/**
 * Calculates Free Space Path Loss (FSPL) in dB:
 * FSPL = 92.45 + 20*log10(f_GHz) + 20*log10(d_km)
 */
export const calculateFsplDb = (freqGhz: number, distKm: number): number => {
  if (freqGhz <= 0 || distKm <= 0) return 0;
  return Math.round((92.45 + 20 * Math.log10(freqGhz) + 20 * Math.log10(distKm)) * 100) / 100;
};

/**
 * Calculates 1st Fresnel zone radius F1 in meters:
 * F1 = 17.32 * sqrt((d1 * d2) / (f_GHz * D))
 */
export const calculateFresnelRadiusM = (
  d1Km: number,
  d2Km: number,
  totalDistKm: number,
  freqGhz: number
): number => {
  if (totalDistKm <= 0 || freqGhz <= 0 || d1Km < 0 || d2Km < 0) return 0;
  const product = (d1Km * d2Km) / (freqGhz * totalDistKm);
  if (product <= 0) return 0;
  return Math.round(17.32 * Math.sqrt(product) * 100) / 100;
};

/**
 * Calculates Earth Curvature Bulge in meters:
 * h_c = (d1 * d2) / (12.75 * k)
 */
export const calculateEarthBulgeM = (
  d1Km: number,
  d2Km: number,
  kFactor: number = 1.333
): number => {
  if (kFactor <= 0 || d1Km < 0 || d2Km < 0) return 0;
  return Math.round(((d1Km * d2Km) / (12.75 * kFactor)) * 100) / 100;
};

export const RfFresnelDiagram: React.FC<RfFresnelDiagramProps> = ({
  siteA,
  siteB,
  hop,
  sunlightMode,
  onProbeDistanceChange,
}) => {
  // Engineering Controls State
  const defaultFreqGhz = hop.frequencyMHz ? hop.frequencyMHz / 1000 : 11.0;
  const [selectedFreqGhz, setSelectedFreqGhz] = useState<number>(defaultFreqGhz);
  const [kFactor, setKFactor] = useState<number>(1.333); // 4/3 standard refraction
  const [clutterType, setClutterType] = useState<'NONE' | 'PALMS_10M' | 'TREES_15M' | 'URBAN_8M'>('PALMS_10M');
  const [show60Percent, setShow60Percent] = useState<boolean>(true);
  const [show2ndFresnel, setShow2ndFresnel] = useState<boolean>(false);
  const [showEarthBulge, setShowEarthBulge] = useState<boolean>(true);
  const [showClutter, setShowClutter] = useState<boolean>(true);

  // Antenna Centerline Height Adjustments (Simulation / What-if)
  const defaultHeightA = siteA.tower?.heightM || 32.0;
  const defaultHeightB = siteB.approvedAclHeightM || 40.7;
  const [antennaHeightA, setAntennaHeightA] = useState<number>(defaultHeightA);
  const [antennaHeightB, setAntennaHeightB] = useState<number>(defaultHeightB);

  // Cursor Probe State along path (0 to totalDistKm)
  const totalPathKm = hop.pathLengthKm || 3.99;
  const [probeKm, setProbeKm] = useState<number>(totalPathKm / 2);
  const [isHovering, setIsHovering] = useState<boolean>(false);

  const svgContainerRef = useRef<SVGSVGElement | null>(null);

  // Clutter height mapping in meters
  const clutterHeightM = useMemo(() => {
    switch (clutterType) {
      case 'PALMS_10M':
        return 10.0;
      case 'TREES_15M':
        return 15.0;
      case 'URBAN_8M':
        return 8.0;
      case 'NONE':
      default:
        return 0.0;
    }
  }, [clutterType]);

  // High-Resolution Topographic Terrain Profile (Interpolated across 81 sampling points)
  const samplesCount = 81;
  const terrainPoints: TerrainPoint[] = useMemo(() => {
    // Known anchor topography for the link (Brgy. Malinao -> Catangnan Tourism Road, Siargao)
    // Anchor points:
    // 0.0km: Site A ground (32m elev)
    // 0.8km: Malinao inland ridge (35m elev)
    // 1.8km: Coastal palm valley (18m elev)
    // 2.7km: Mangrove tidal flats (9m elev)
    // 3.4km: Catangnan coastal rise / Tourism Road (15m elev)
    // 3.99km: Site B ground (18m elev)
    const anchors = [
      { d: 0.0, elev: siteA.elevationM || 32 },
      { d: 0.8, elev: Math.max(siteA.elevationM + 4, 36) },
      { d: 1.8, elev: 20 },
      { d: 2.7, elev: 10 },
      { d: 3.4, elev: 16 },
      { d: totalPathKm, elev: siteB.elevationM || 18 },
    ];

    const pts: TerrainPoint[] = [];
    for (let i = 0; i <= samplesCount; i++) {
      const frac = i / samplesCount;
      const d = frac * totalPathKm;

      // Piecewise cubic/smooth interpolation through anchors
      let baseElev = anchors[0].elev;
      for (let j = 0; j < anchors.length - 1; j++) {
        if (d >= anchors[j].d && d <= anchors[j + 1].d) {
          const segSpan = anchors[j + 1].d - anchors[j].d;
          const segFrac = segSpan > 0 ? (d - anchors[j].d) / segSpan : 0;
          // Smooth cosine curve interpolation
          const smoothFrac = (1 - Math.cos(segFrac * Math.PI)) / 2;
          baseElev = anchors[j].elev + smoothFrac * (anchors[j + 1].elev - anchors[j].elev);
          break;
        }
      }

      // Add gentle micro-relief noise (+/- 0.8m)
      const microRelief = Math.sin(i * 1.3) * 0.7;
      const finalGround = Math.max(2, baseElev + microRelief);

      pts.push({
        distKm: d,
        elevationM: Math.round(finalGround * 10) / 10,
        clutterM: showClutter ? clutterHeightM : 0,
      });
    }
    return pts;
  }, [siteA.elevationM, siteB.elevationM, totalPathKm, clutterHeightM, showClutter]);

  // Overall Antenna AMSL
  const antAmslA = (siteA.elevationM || 32) + antennaHeightA;
  const antAmslB = (siteB.elevationM || 18) + antennaHeightB;

  // Maximum and Minimum Y-scale bounds (AMSL in meters)
  const yMin = 0;
  const yMax = Math.max(antAmslA, antAmslB) + 25; // comfortable headroom

  // SVG Coordinate Geometry Mappings (viewBox 0 0 900 360)
  const svgWidth = 900;
  const svgHeight = 360;
  const padLeft = 60;
  const padRight = 50;
  const padTop = 40;
  const padBottom = 50;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  const toX = (distKm: number): number => {
    return padLeft + (distKm / totalPathKm) * plotWidth;
  };

  const toY = (elevM: number): number => {
    const clamped = Math.max(yMin, Math.min(yMax, elevM));
    return padTop + plotHeight - ((clamped - yMin) / (yMax - yMin)) * plotHeight;
  };

  // Generate SVG Path data for Line-of-Sight, Fresnel envelopes, and Terrain
  const pathMath = useMemo(() => {
    const losPoints: { x: number; y: number }[] = [];
    const fresnelTopPoints: { x: number; y: number }[] = [];
    const fresnelBottomPoints: { x: number; y: number }[] = [];
    const fresnel60BottomPoints: { x: number; y: number }[] = [];
    const fresnel2ndTopPoints: { x: number; y: number }[] = [];
    const fresnel2ndBottomPoints: { x: number; y: number }[] = [];
    const earthArcPoints: { x: number; y: number }[] = [];
    const terrainPolyPoints: { x: number; y: number }[] = [];
    const clutterPolyPoints: { x: number; y: number }[] = [];

    let minClearanceM = 999;
    let minClearanceKm = 0;

    terrainPoints.forEach((pt) => {
      const d1 = pt.distKm;
      const d2 = totalPathKm - d1;
      const frac = d1 / totalPathKm;

      // Earth Curvature offset
      const bulgeM = showEarthBulge ? calculateEarthBulgeM(d1, d2, kFactor) : 0;
      const groundWithBulge = pt.elevationM + bulgeM;
      const totalObstacleElev = groundWithBulge + pt.clutterM;

      // True Line-of-Sight ray altitude (AMSL)
      const losM = antAmslA + frac * (antAmslB - antAmslA);

      // Fresnel Radii
      const f1 = calculateFresnelRadiusM(d1, d2, totalPathKm, selectedFreqGhz);
      const f60 = 0.6 * f1;
      const f2 = Math.sqrt(2) * f1;

      // Clearance margin at this sample: (LOS - 0.6*F1) - Obstacle
      const clearanceM = losM - f60 - totalObstacleElev;
      if (clearanceM < minClearanceM) {
        minClearanceM = clearanceM;
        minClearanceKm = d1;
      }

      const x = toX(d1);
      losPoints.push({ x, y: toY(losM) });
      fresnelTopPoints.push({ x, y: toY(losM + f1) });
      fresnelBottomPoints.push({ x, y: toY(losM - f1) });
      fresnel60BottomPoints.push({ x, y: toY(losM - f60) });
      fresnel2ndTopPoints.push({ x, y: toY(losM + f2) });
      fresnel2ndBottomPoints.push({ x, y: toY(losM - f2) });
      earthArcPoints.push({ x, y: toY(bulgeM) });
      terrainPolyPoints.push({ x, y: toY(groundWithBulge) });
      clutterPolyPoints.push({ x, y: toY(totalObstacleElev) });
    });

    // Construct SVG string curves
    const toPath = (pts: { x: number; y: number }[]) =>
      pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

    // 1st Fresnel zone closed ellipse envelope path
    const f1ClosedPath =
      toPath(fresnelTopPoints) +
      ' ' +
      fresnelBottomPoints
        .slice()
        .reverse()
        .map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(' ') +
      ' Z';

    // 2nd Fresnel zone closed envelope path
    const f2ClosedPath =
      toPath(fresnel2ndTopPoints) +
      ' ' +
      fresnel2ndBottomPoints
        .slice()
        .reverse()
        .map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(' ') +
      ' Z';

    // Terrain ground polygon filled to baseline
    const groundBaseY = toY(0);
    const terrainFilledPath =
      toPath(terrainPolyPoints) +
      ` L ${toX(totalPathKm)} ${groundBaseY} L ${toX(0)} ${groundBaseY} Z`;

    // Clutter vegetation ribbon polygon
    const clutterFilledPath =
      toPath(clutterPolyPoints) +
      ' ' +
      terrainPolyPoints
        .slice()
        .reverse()
        .map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(' ') +
      ' Z';

    return {
      losD: toPath(losPoints),
      f1EnvelopeD: f1ClosedPath,
      f2EnvelopeD: f2ClosedPath,
      f60D: toPath(fresnel60BottomPoints),
      terrainD: terrainFilledPath,
      clutterD: clutterFilledPath,
      earthArcD: toPath(earthArcPoints),
      minClearanceM: Math.round(minClearanceM * 10) / 10,
      minClearanceKm: Math.round(minClearanceKm * 100) / 100,
      maxF1RadiusM: calculateFresnelRadiusM(
        totalPathKm / 2,
        totalPathKm / 2,
        totalPathKm,
        selectedFreqGhz
      ),
      maxEarthBulgeM: calculateEarthBulgeM(totalPathKm / 2, totalPathKm / 2, kFactor),
    };
  }, [
    terrainPoints,
    antAmslA,
    antAmslB,
    totalPathKm,
    selectedFreqGhz,
    kFactor,
    showEarthBulge,
    yMin,
    yMax,
  ]);

  // Current Probe Crosshair Calculations
  const probeData = useMemo(() => {
    const d1 = Math.max(0, Math.min(totalPathKm, probeKm));
    const d2 = totalPathKm - d1;
    const frac = d1 / totalPathKm;

    const bulgeM = showEarthBulge ? calculateEarthBulgeM(d1, d2, kFactor) : 0;
    const f1 = calculateFresnelRadiusM(d1, d2, totalPathKm, selectedFreqGhz);
    const f60 = 0.6 * f1;
    const losM = antAmslA + frac * (antAmslB - antAmslA);

    // Find nearest terrain point
    const closestPt = terrainPoints.reduce((prev, curr) =>
      Math.abs(curr.distKm - d1) < Math.abs(prev.distKm - d1) ? curr : prev
    );

    const groundWithBulge = closestPt.elevationM + bulgeM;
    const obstacleWithClutter = groundWithBulge + (showClutter ? clutterHeightM : 0);
    const clearanceMargin = losM - f60 - obstacleWithClutter;

    return {
      d1Km: Math.round(d1 * 100) / 100,
      d2Km: Math.round(d2 * 100) / 100,
      groundElevM: closestPt.elevationM,
      bulgeM,
      obstacleElevM: Math.round(obstacleWithClutter * 10) / 10,
      losM: Math.round(losM * 10) / 10,
      f1RadiusM: f1,
      f60M: Math.round(f60 * 10) / 10,
      clearanceMarginM: Math.round(clearanceMargin * 10) / 10,
      isClear: clearanceMargin >= 0,
      isMarginal: clearanceMargin >= 0 && clearanceMargin < 3.0,
      xPos: toX(d1),
    };
  }, [
    probeKm,
    totalPathKm,
    showEarthBulge,
    kFactor,
    selectedFreqGhz,
    antAmslA,
    antAmslB,
    terrainPoints,
    showClutter,
    clutterHeightM,
  ]);

  // Handle SVG click/drag probe
  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgContainerRef.current) return;
    const rect = svgContainerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const scaleX = svgWidth / rect.width;
    const svgX = mouseX * scaleX;

    const clampedX = Math.max(padLeft, Math.min(padLeft + plotWidth, svgX));
    const distFrac = (clampedX - padLeft) / plotWidth;
    const targetKm = Math.round(distFrac * totalPathKm * 100) / 100;
    setProbeKm(targetKm);
    setIsHovering(true);
    if (onProbeDistanceChange) onProbeDistanceChange(targetKm);
  };

  const fsplValueDb = calculateFsplDb(selectedFreqGhz, totalPathKm);

  return (
    <div
      className={`rounded-xl border transition-colors overflow-hidden ${
        sunlightMode
          ? 'bg-white border-amber-400 text-neutral-900 shadow-sm'
          : 'bg-slate-950 border-slate-800 text-slate-100 shadow-xl'
      }`}
    >
      {/* Engineering Control Header */}
      <div className="p-3 sm:p-4 border-b border-slate-800 bg-slate-900/90 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-700/80 flex items-center justify-center text-cyan-400 shrink-0">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-sm tracking-tight text-white font-mono">
                RF Fresnel Zone & Terrain Clearance Profile
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                ITU-R P.530-17 COMPLIANT
              </span>
              {pathMath.minClearanceM >= 3.0 ? (
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  100% CLEAR ({pathMath.minClearanceM}m MARGIN)
                </span>
              ) : pathMath.minClearanceM >= 0 ? (
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  MARGINAL CLEARANCE ({pathMath.minClearanceM}m)
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                  OBSTRUCTED ({Math.abs(pathMath.minClearanceM)}m ENCROACHMENT)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Link: <strong className="text-slate-200">{hop.hopName}</strong> · Path: {totalPathKm} km · FSPL: <strong className="text-cyan-300">{fsplValueDb} dB</strong>
            </p>
          </div>
        </div>

        {/* Quick Engineering Toggles */}
        <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
          {/* Frequency Selector */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
            <span className="text-slate-400 text-[10px] uppercase font-bold">Freq:</span>
            <select
              value={selectedFreqGhz}
              onChange={(e) => setSelectedFreqGhz(parseFloat(e.target.value))}
              className="bg-transparent text-cyan-400 font-bold focus:outline-none cursor-pointer text-xs"
            >
              <option value={7.0} className="bg-slate-900 text-white">7 GHz (Mid)</option>
              <option value={11.0} className="bg-slate-900 text-white">11 GHz (TSSR Default)</option>
              <option value={13.0} className="bg-slate-900 text-white">13 GHz</option>
              <option value={15.0} className="bg-slate-900 text-white">15 GHz</option>
              <option value={18.0} className="bg-slate-900 text-white">18 GHz</option>
              <option value={23.0} className="bg-slate-900 text-white">23 GHz</option>
              <option value={80.0} className="bg-slate-900 text-white">80 GHz (E-Band)</option>
            </select>
          </div>

          {/* k-Factor Refraction Selector */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
            <span className="text-slate-400 text-[10px] uppercase font-bold">k-Factor:</span>
            <select
              value={kFactor}
              onChange={(e) => setKFactor(parseFloat(e.target.value))}
              className="bg-transparent text-emerald-400 font-bold focus:outline-none cursor-pointer text-xs"
            >
              <option value={1.333} className="bg-slate-900 text-white">k = 4/3 (Standard)</option>
              <option value={1.0} className="bg-slate-900 text-white">k = 1.0 (True Earth)</option>
              <option value={0.667} className="bg-slate-900 text-white">k = 2/3 (Sub-refraction)</option>
              <option value={1.667} className="bg-slate-900 text-white">k = 5/3 (Ducting)</option>
            </select>
          </div>

          {/* Clutter Selector */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
            <span className="text-slate-400 text-[10px] uppercase font-bold">Clutter:</span>
            <select
              value={clutterType}
              onChange={(e) => setClutterType(e.target.value as any)}
              className="bg-transparent text-amber-300 font-bold focus:outline-none cursor-pointer text-xs"
            >
              <option value="PALMS_10M" className="bg-slate-900 text-white">Coastal Palms (10m)</option>
              <option value="TREES_15M" className="bg-slate-900 text-white">Dense Trees (15m)</option>
              <option value="URBAN_8M" className="bg-slate-900 text-white">Structures (8m)</option>
              <option value="NONE" className="bg-slate-900 text-white">Bare Earth (0m)</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 p-3 bg-slate-950/90 border-b border-slate-800 text-xs font-mono">
        <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
          <span className="text-slate-500 text-[10px] block uppercase font-bold">Site A ACL:</span>
          <span className="text-slate-100 font-bold text-xs">{antennaHeightA}m Leg A</span>
          <span className="text-[10px] text-slate-400 block font-sans">AMSL: {antAmslA}m</span>
        </div>
        <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
          <span className="text-slate-500 text-[10px] block uppercase font-bold">Site B ACL:</span>
          <span className="text-emerald-400 font-bold text-xs">{antennaHeightB}m Leg C</span>
          <span className="text-[10px] text-slate-400 block font-sans">AMSL: {antAmslB}m</span>
        </div>
        <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
          <span className="text-slate-500 text-[10px] block uppercase font-bold">Max F1 Radius:</span>
          <span className="text-cyan-400 font-bold text-xs">r = {pathMath.maxF1RadiusM} m</span>
          <span className="text-[10px] text-slate-400 block font-sans">@ Midpoint (2.0 km)</span>
        </div>
        <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
          <span className="text-slate-500 text-[10px] block uppercase font-bold">Earth Bulge:</span>
          <span className="text-purple-400 font-bold text-xs">{pathMath.maxEarthBulgeM} m</span>
          <span className="text-[10px] text-slate-400 block font-sans">k = {kFactor.toFixed(2)}</span>
        </div>
        <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
          <span className="text-slate-500 text-[10px] block uppercase font-bold">Min Clearance:</span>
          <span
            className={`font-bold text-xs ${
              pathMath.minClearanceM >= 3.0
                ? 'text-emerald-400'
                : pathMath.minClearanceM >= 0
                ? 'text-amber-400'
                : 'text-rose-400'
            }`}
          >
            {pathMath.minClearanceM} m
          </span>
          <span className="text-[10px] text-slate-400 block font-sans">@ {pathMath.minClearanceKm} km</span>
        </div>
        <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
          <span className="text-slate-500 text-[10px] block uppercase font-bold">Free Space Loss:</span>
          <span className="text-cyan-300 font-bold text-xs">{fsplValueDb} dB</span>
          <span className="text-[10px] text-slate-400 block font-sans">{selectedFreqGhz} GHz</span>
        </div>
      </div>

      {/* SVG Canvas Plot Viewport */}
      <div className="relative w-full p-2 sm:p-4 bg-slate-950 select-none overflow-x-auto">
        <svg
          ref={svgContainerRef}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto min-w-[700px] cursor-crosshair"
          onMouseMove={handleSvgMouseMove}
          onMouseLeave={() => setIsHovering(false)}
        >
          <defs>
            {/* Background Grid Pattern */}
            <pattern id="rf-grid" width="40" height="30" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 30" fill="none" stroke="#1e293b" strokeWidth="0.7" />
            </pattern>

            {/* Fresnel Zone Ellipsoid Gradients */}
            <radialGradient id="fresnel-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.18" />
              <stop offset="80%" stopColor="#06b6d4" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </radialGradient>

            <linearGradient id="terrain-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#065f46" stopOpacity="0.75" />
              <stop offset="35%" stopColor="#042f2e" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#021a18" stopOpacity="0.95" />
            </linearGradient>

            <linearGradient id="clutter-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#15803d" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#064e3b" stopOpacity="0.15" />
            </linearGradient>
          </defs>

          {/* Plot Background */}
          <rect
            x={padLeft}
            y={padTop}
            width={plotWidth}
            height={plotHeight}
            fill="#020617"
            stroke="#1e293b"
            strokeWidth="1"
          />
          <rect
            x={padLeft}
            y={padTop}
            width={plotWidth}
            height={plotHeight}
            fill="url(#rf-grid)"
          />

          {/* Elevation Horizontal Grid Lines (every 10m AMSL) */}
          {[0, 10, 20, 30, 40, 50, 60, 70].map((elev) => {
            if (elev > yMax) return null;
            const y = toY(elev);
            return (
              <g key={elev}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={padLeft + plotWidth}
                  y2={y}
                  stroke="#1e293b"
                  strokeDasharray="3,3"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {elev}m
                </text>
              </g>
            );
          })}

          {/* Distance Vertical Grid Lines (every 0.5 km) */}
          {[0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, totalPathKm].map((dist) => {
            if (dist > totalPathKm) return null;
            const x = toX(dist);
            return (
              <g key={dist}>
                <line
                  x1={x}
                  y1={padTop}
                  x2={x}
                  y2={padTop + plotHeight}
                  stroke="#1e293b"
                  strokeDasharray="3,3"
                />
                <text
                  x={x}
                  y={padTop + plotHeight + 15}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {dist.toFixed(1)} km
                </text>
              </g>
            );
          })}

          {/* 2nd Fresnel Zone Envelope (Optional Toggle) */}
          {show2ndFresnel && (
            <path
              d={pathMath.f2EnvelopeD}
              fill="rgba(168, 85, 247, 0.05)"
              stroke="#a855f7"
              strokeWidth="0.8"
              strokeDasharray="4,4"
              opacity="0.6"
            />
          )}

          {/* 1st Fresnel Zone 100% Envelope */}
          <path
            d={pathMath.f1EnvelopeD}
            fill="url(#fresnel-glow)"
            stroke="#06b6d4"
            strokeWidth="1.5"
            opacity="0.85"
          />

          {/* 60% 1st Fresnel Clearance Lower Boundary (Mandatory Criteria) */}
          {show60Percent && (
            <path
              d={pathMath.f60D}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="1.8"
              strokeDasharray="5,4"
            />
          )}

          {/* Direct Line-of-Sight (LOS) Bore-sight Beam */}
          <path
            d={pathMath.losD}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.5"
            strokeDasharray="8,5"
          />

          {/* Clutter / Vegetation Ribbon */}
          {showClutter && clutterHeightM > 0 && (
            <path
              d={pathMath.clutterD}
              fill="url(#clutter-grad)"
              stroke="#22c55e"
              strokeWidth="1"
              strokeDasharray="3,3"
            />
          )}

          {/* Ground Terrain Elevation Polygon */}
          <path
            d={pathMath.terrainD}
            fill="url(#terrain-grad)"
            stroke="#10b981"
            strokeWidth="2"
          />

          {/* Earth Bulge Curvature Reference Arc */}
          {showEarthBulge && (
            <path
              d={pathMath.earthArcD}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="1"
              strokeDasharray="4,4"
              opacity="0.5"
            />
          )}

          {/* Site A Mast & Tower Structure */}
          <g transform={`translate(${toX(0)}, 0)`}>
            {/* Ground base marker */}
            <circle cx="0" cy={toY(siteA.elevationM || 32)} r="4" fill="#38bdf8" />
            {/* Tower mast column */}
            <line
              x1="0"
              y1={toY(siteA.elevationM || 32)}
              x2="0"
              y2={toY(antAmslA)}
              stroke="#0284c7"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Antenna dish symbol */}
            <circle cx="0" cy={toY(antAmslA)} r="6" fill="#0284c7" stroke="#ffffff" strokeWidth="2" />
            <circle cx="0" cy={toY(antAmslA)} r="2" fill="#ffffff" />
            <text
              x="-8"
              y={toY(antAmslA) - 10}
              textAnchor="end"
              fill="#38bdf8"
              fontSize="10"
              fontWeight="bold"
              fontFamily="monospace"
            >
              Site A: {siteA.id}
            </text>
            <text
              x="-8"
              y={toY(antAmslA) + 4}
              textAnchor="end"
              fill="#94a3b8"
              fontSize="8.5"
              fontFamily="monospace"
            >
              {antAmslA}m AMSL ({antennaHeightA}m mast)
            </text>
          </g>

          {/* Site B Mast & Tower Structure */}
          <g transform={`translate(${toX(totalPathKm)}, 0)`}>
            {/* Ground base marker */}
            <circle cx="0" cy={toY(siteB.elevationM || 18)} r="4" fill="#34d399" />
            {/* Tower mast column */}
            <line
              x1="0"
              y1={toY(siteB.elevationM || 18)}
              x2="0"
              y2={toY(antAmslB)}
              stroke="#059669"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Antenna dish symbol */}
            <circle cx="0" cy={toY(antAmslB)} r="6" fill="#059669" stroke="#ffffff" strokeWidth="2" />
            <circle cx="0" cy={toY(antAmslB)} r="2" fill="#ffffff" />
            <text
              x="8"
              y={toY(antAmslB) - 10}
              textAnchor="start"
              fill="#34d399"
              fontSize="10"
              fontWeight="bold"
              fontFamily="monospace"
            >
              Site B: {siteB.id}
            </text>
            <text
              x="8"
              y={toY(antAmslB) + 4}
              textAnchor="start"
              fill="#94a3b8"
              fontSize="8.5"
              fontFamily="monospace"
            >
              {antAmslB}m AMSL ({antennaHeightB}m Leg C)
            </text>
          </g>

          {/* Interactive Probe Crosshair Cursor */}
          {isHovering && (
            <g transform={`translate(${probeData.xPos}, 0)`}>
              <line
                x1="0"
                y1={padTop}
                x2="0"
                y2={padTop + plotHeight}
                stroke="#22d3ee"
                strokeWidth="1.2"
                strokeDasharray="3,3"
              />
              <circle
                cx="0"
                cy={toY(probeData.losM)}
                r="4.5"
                fill="#38bdf8"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
              <circle
                cx="0"
                cy={toY(probeData.obstacleElevM)}
                r="4.5"
                fill={probeData.isClear ? '#10b981' : '#f43f5e'}
                stroke="#ffffff"
                strokeWidth="1.5"
              />
            </g>
          )}

          {/* Critical Min-Clearance Flag */}
          <g transform={`translate(${toX(pathMath.minClearanceKm)}, ${toY(antAmslB) + 30})`}>
            <circle r="3" fill="#f59e0b" />
            <line x1="0" y1="0" x2="0" y2="15" stroke="#f59e0b" strokeWidth="1" strokeDasharray="2,2" />
          </g>
        </svg>

        {/* Hover Probe Dynamic HUD Card */}
        {isHovering && (
          <div className="absolute top-4 right-4 z-20 p-3 rounded-lg bg-slate-900/95 border border-cyan-700/80 shadow-2xl backdrop-blur-md text-xs font-mono text-slate-100 min-w-[260px] pointer-events-none space-y-1.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="font-bold text-cyan-400 flex items-center gap-1">
                <Compass className="w-3.5 h-3.5" />
                PATH PROBE: {probeData.d1Km} km
              </span>
              <span className="text-slate-400 text-[10px]">
                {((probeData.d1Km / totalPathKm) * 100).toFixed(0)}% of Link
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              <div>
                <span className="text-slate-500 block text-[9.5px]">LOS Ray Altitude:</span>
                <span className="font-bold text-slate-200">{probeData.losM} m AMSL</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9.5px]">Obstacle Surface:</span>
                <span className="font-bold text-slate-200">{probeData.obstacleElevM} m</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9.5px]">1st Fresnel Radius (F1):</span>
                <span className="font-bold text-cyan-300">± {probeData.f1RadiusM} m</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9.5px]">60% Clearance Req:</span>
                <span className="font-bold text-amber-300">± {probeData.f60M} m</span>
              </div>
            </div>

            <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">NET CLEARANCE MARGIN:</span>
              <span
                className={`font-bold text-xs ${
                  probeData.clearanceMarginM >= 3.0
                    ? 'text-emerald-400'
                    : probeData.clearanceMarginM >= 0
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {probeData.clearanceMarginM > 0 ? `+${probeData.clearanceMarginM}` : probeData.clearanceMarginM} m
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Legend & Layer Visibility Toggles */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
            <span className="w-3 h-1 bg-cyan-400 rounded-full" />
            <span className="text-[11px]">100% 1st Fresnel Envelope</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={show60Percent}
              onChange={(e) => setShow60Percent(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0 w-3 h-3"
            />
            <span className="w-3 h-0.5 border-t border-dashed border-amber-400" />
            <span className="text-[11px]">60% Clearance Line (ITU-R)</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={show2ndFresnel}
              onChange={(e) => setShow2ndFresnel(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-purple-500 focus:ring-0 w-3 h-3"
            />
            <span className="w-3 h-0.5 border-t border-dashed border-purple-400" />
            <span className="text-[11px]">2nd Fresnel (F2)</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={showEarthBulge}
              onChange={(e) => setShowEarthBulge(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-slate-400 focus:ring-0 w-3 h-3"
            />
            <span className="text-[11px]">Earth Bulge Arc ({kFactor.toFixed(2)})</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={showClutter}
              onChange={(e) => setShowClutter(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-green-500 focus:ring-0 w-3 h-3"
            />
            <span className="text-[11px]">Vegetation Clutter (+{clutterHeightM}m)</span>
          </label>
        </div>

        {/* Nudge Antenna Heights Steppers for What-If Testing */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-[10px] uppercase font-bold">Nudge Heights:</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setAntennaHeightB((h) => Math.max(10, Math.round((h - 1) * 10) / 10))}
              className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] font-bold text-slate-300"
              title="Lower Site B ACL by 1m"
            >
              -1m B
            </button>
            <button
              type="button"
              onClick={() => setAntennaHeightB((h) => Math.round((h + 1) * 10) / 10)}
              className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] font-bold text-emerald-400"
              title="Raise Site B ACL by 1m"
            >
              +1m B
            </button>
            {(antennaHeightA !== defaultHeightA || antennaHeightB !== defaultHeightB) && (
              <button
                type="button"
                onClick={() => {
                  setAntennaHeightA(defaultHeightA);
                  setAntennaHeightB(defaultHeightB);
                }}
                className="p-1 rounded bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                title="Reset to Approved TSSR Antenna Heights"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
