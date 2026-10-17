import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Site, Hop } from '../../types/fieldops';
import {
  Radio,
  Maximize2,
  Minimize2,
  MapPin,
  Compass,
  ArrowRightLeft,
  Navigation,
  Layers,
  Info,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Phone,
  Shield,
  Eye,
  Sliders,
} from 'lucide-react';

interface SiteMapLeafletProps {
  siteA: Site;
  siteB: Site;
  hop: Hop;
  allSites?: Site[];
  onSelectSite?: (site: Site) => void;
  probeDistanceKm?: number;
  sunlightMode: boolean;
}

/**
 * Calculates great-circle distance between two coordinates using Haversine formula (Earth R = 6371.0 km)
 */
export const calculateHaversineDistanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
};

/**
 * Calculates initial true bearing (forward azimuth) from point 1 to point 2 in degrees.
 */
export const calculateBearingDeg = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return Math.round((((theta * 180) / Math.PI + 360) % 360) * 100) / 100;
};

/**
 * Calculates Free Space Path Loss (FSPL) in dB:
 * FSPL = 92.45 + 20*log10(f_GHz) + 20*log10(d_km)
 */
export const calculateFsplDb = (freqGhz: number, distKm: number): number => {
  if (freqGhz <= 0 || distKm <= 0) return 0;
  return Math.round((92.45 + 20 * Math.log10(freqGhz) + 20 * Math.log10(distKm)) * 100) / 100;
};

/**
 * Generates an offset destination point given start point, bearing in degrees, and distance in meters.
 */
const destinationPoint = (
  lat: number,
  lon: number,
  bearingDeg: number,
  distanceM: number
): [number, number] => {
  const R = 6371000; // Earth radius in meters
  const δ = distanceM / R;
  const θ = (bearingDeg * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lon * Math.PI) / 180;

  const sinφ2 = Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);
  const y = Math.sin(θ) * Math.sin(δ) * Math.cos(φ1);
  const x = Math.cos(δ) - Math.sin(φ1) * sinφ2;
  const λ2 = λ1 + Math.atan2(y, x);

  return [(φ2 * 180) / Math.PI, (λ2 * 180) / Math.PI];
};

export const SiteMapLeaflet: React.FC<SiteMapLeafletProps> = ({
  siteA,
  siteB,
  hop,
  allSites = [],
  onSelectSite,
  probeDistanceKm,
  sunlightMode,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const probeMarkerRef = useRef<L.Marker | null>(null);

  // Map Controls State
  const [mapStyle, setMapStyle] = useState<'DARK' | 'SATELLITE' | 'TOPO' | 'STREET'>('DARK');
  const [showFresnelSwath, setShowFresnelSwath] = useState<boolean>(true);
  const [showBeamCones, setShowBeamCones] = useState<boolean>(true);
  const [showAuxSites, setShowAuxSites] = useState<boolean>(true);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [selectedSiteModal, setSelectedSiteModal] = useState<Site | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Geodesic & Link Geometry Calculations
  const haversineDistKm = calculateHaversineDistanceKm(
    siteA.lat,
    siteA.long,
    siteB.lat,
    siteB.long
  );

  const forwardBearing = calculateBearingDeg(
    siteA.lat,
    siteA.long,
    siteB.lat,
    siteB.long
  );

  const reverseBearing = calculateBearingDeg(
    siteB.lat,
    siteB.long,
    siteA.lat,
    siteA.long
  );

  const elevationDelta = Math.abs((siteB.elevationM || 18) - (siteA.elevationM || 32));
  const freqGhz = hop.frequencyMHz ? hop.frequencyMHz / 1000 : 11.0;
  const fsplDb = calculateFsplDb(freqGhz, haversineDistKm);
  const maxF1RadiusM = Math.round(17.32 * Math.sqrt((haversineDistKm / 4) / freqGhz) * 100) / 100;

  const tileUrls = {
    DARK: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    SATELLITE: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    TOPO: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    STREET: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  };

  const tileAttributions = {
    DARK: '&copy; OpenStreetMap &copy; CARTO',
    SATELLITE: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
    TOPO: 'Map data &copy; OpenStreetMap contributors, SRTM | Map style &copy; OpenTopoMap (CC-BY-SA)',
    STREET: '&copy; OpenStreetMap contributors',
  };

  // Compile unique sites list
  const sitesToRender = allSites.length > 0 ? allSites : [siteA, siteB];
  const uniqueSitesMap = new Map<string, Site>();
  uniqueSitesMap.set(siteA.id, siteA);
  uniqueSitesMap.set(siteB.id, siteB);
  if (showAuxSites) {
    sitesToRender.forEach((s) => {
      if (!uniqueSitesMap.has(s.id)) uniqueSitesMap.set(s.id, s);
    });
  }
  const renderList = Array.from(uniqueSitesMap.values());

  // Copy coordinates handler
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize Leaflet Map
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    });
    mapInstanceRef.current = map;

    // Add Tile Layer
    const layer = L.tileLayer(tileUrls[mapStyle], {
      attribution: tileAttributions[mapStyle],
      maxZoom: 19,
    }).addTo(map);
    tileLayerRef.current = layer;

    // 1. Render Fresnel Ground Footprint Swath (Polygon along path)
    if (showFresnelSwath) {
      const swathSegments = 16;
      const leftCoords: [number, number][] = [];
      const rightCoords: [number, number][] = [];

      for (let i = 0; i <= swathSegments; i++) {
        const frac = i / swathSegments;
        const curLat = siteA.lat + frac * (siteB.lat - siteA.lat);
        const curLong = siteA.long + frac * (siteB.long - siteA.long);

        // Distance from each site in km
        const d1 = frac * haversineDistKm;
        const d2 = (1 - frac) * haversineDistKm;

        // Fresnel radius at this point in meters
        const rM = Math.max(1, 17.32 * Math.sqrt((d1 * d2) / (freqGhz * haversineDistKm)));

        // Perpendicular bearings (+90° and -90°)
        const leftPt = destinationPoint(curLat, curLong, (forwardBearing - 90 + 360) % 360, rM);
        const rightPt = destinationPoint(curLat, curLong, (forwardBearing + 90) % 360, rM);

        leftCoords.push(leftPt);
        rightCoords.push(rightPt);
      }

      // Combine into closed polygon
      const swathPolygonCoords = [...leftCoords, ...rightCoords.reverse()];
      L.polygon(swathPolygonCoords, {
        color: '#06b6d4',
        weight: 1,
        fillColor: '#06b6d4',
        fillOpacity: 0.12,
        dashArray: '3, 4',
      }).addTo(map);
    }

    // 2. Render Antenna Radiation Pattern Cones (Beamwidth ~1.8° for 1.2m dish at 11 GHz)
    if (showBeamCones) {
      const beamHalfAngle = 1.2; // degrees
      const coneLengthM = Math.min(1200, haversineDistKm * 300); // 1.2 km beam projection

      // Site A beam cone (A -> B)
      const aLeft = destinationPoint(siteA.lat, siteA.long, forwardBearing - beamHalfAngle, coneLengthM);
      const aRight = destinationPoint(siteA.lat, siteA.long, forwardBearing + beamHalfAngle, coneLengthM);
      L.polygon([[siteA.lat, siteA.long], aLeft, aRight], {
        color: '#38bdf8',
        weight: 1,
        fillColor: '#38bdf8',
        fillOpacity: 0.22,
      }).addTo(map);

      // Site B beam cone (B -> A)
      const bLeft = destinationPoint(siteB.lat, siteB.long, reverseBearing - beamHalfAngle, coneLengthM);
      const bRight = destinationPoint(siteB.lat, siteB.long, reverseBearing + beamHalfAngle, coneLengthM);
      L.polygon([[siteB.lat, siteB.long], bLeft, bRight], {
        color: '#34d399',
        weight: 1,
        fillColor: '#34d399',
        fillOpacity: 0.22,
      }).addTo(map);
    }

    // 3. Render High-Contrast Polyline between Site A and Site B
    const pathCoordinates: L.LatLngExpression[] = [
      [siteA.lat, siteA.long],
      [siteB.lat, siteB.long],
    ];

    // Background glowing halo
    L.polyline(pathCoordinates, {
      color: '#06b6d4',
      weight: 7,
      opacity: 0.35,
    }).addTo(map);

    // Foreground dashed RF beam polyline
    const rfLine = L.polyline(pathCoordinates, {
      color: '#22d3ee',
      weight: 3,
      dashArray: '8, 6',
      opacity: 0.95,
    }).addTo(map);

    // 4. Render Markers for All Sites
    renderList.forEach((site) => {
      const isSiteA = site.id === siteA.id;
      const isSiteB = site.id === siteB.id;

      let colorHex = '#a855f7'; // Purple for auxiliary sites
      let roleLabel = 'AUX';
      let haloColor = 'rgba(168, 85, 247, 0.7)';

      if (isSiteA) {
        colorHex = '#0284c7'; // Sky Blue for Site A
        roleLabel = 'SITE A';
        haloColor = 'rgba(2, 132, 199, 0.85)';
      } else if (isSiteB) {
        colorHex = '#059669'; // Emerald for Site B
        roleLabel = 'SITE B';
        haloColor = 'rgba(5, 150, 105, 0.85)';
      }

      const siteIcon = L.divIcon({
        className: 'custom-site-marker',
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
            <div style="
              width: 32px;
              height: 32px;
              background: ${colorHex};
              border: 2px solid #ffffff;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 0 14px ${haloColor};
              transition: transform 0.2s ease;
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/>
                <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/>
                <circle cx="12" cy="12" r="2"/>
                <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/>
                <path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1"/>
              </svg>
            </div>
            <div style="
              background: rgba(15, 23, 42, 0.95);
              border: 1px solid ${colorHex};
              color: #ffffff;
              font-family: ui-monospace, SFMono-Regular, monospace;
              font-size: 9.5px;
              font-weight: 700;
              padding: 2px 6px;
              border-radius: 4px;
              margin-top: 3px;
              white-space: nowrap;
              box-shadow: 0 2px 8px rgba(0,0,0,0.6);
            ">
              ${roleLabel}: ${site.id}
            </div>
          </div>
        `,
        iconSize: [110, 56],
        iconAnchor: [55, 16],
      });

      const marker = L.marker([site.lat, site.long], { icon: siteIcon }).addTo(map);

      marker.on('click', () => {
        setSelectedSiteModal(site);
        if (onSelectSite) onSelectSite(site);
      });
    });

    // 5. Midpoint Metric Badge on Polyline
    const midLat = (siteA.lat + siteB.lat) / 2;
    const midLong = (siteA.long + siteB.long) / 2;

    const distanceBadgeIcon = L.divIcon({
      className: 'haversine-distance-badge-icon',
      html: `
        <div style="
          position: absolute;
          transform: translate(-50%, -50%);
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: rgba(2, 6, 23, 0.95);
          border: 1.5px solid #22d3ee;
          padding: 2.5px 8px;
          border-radius: 9999px;
          box-shadow: 0 0 14px rgba(34, 211, 238, 0.7);
          color: #ffffff;
          font-family: ui-monospace, SFMono-Regular, monospace;
          font-size: 10.5px;
          font-weight: 700;
          white-space: nowrap;
          cursor: pointer;
        ">
          <span style="color: #22d3ee; font-size: 12px; line-height: 1;">⟷</span>
          <span>${haversineDistKm.toFixed(2)} km</span>
          <span style="
            font-size: 8px;
            color: #67e8f9;
            background: rgba(8, 51, 68, 0.85);
            padding: 1px 4px;
            border-radius: 3px;
            border: 1px solid #0e7490;
            font-weight: 600;
          ">HAVERSINE</span>
        </div>
      `,
      iconSize: [0, 0],
    });

    L.marker([midLat, midLong], {
      icon: distanceBadgeIcon,
      zIndexOffset: 500,
    }).addTo(map);

    // Initial Map Bounds Fitting
    const latLngList: L.LatLngExpression[] = renderList.map((s) => [s.lat, s.long]);
    const bounds = L.latLngBounds(latLngList);
    map.fitBounds(bounds, { padding: [50, 50] });

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [
    siteA.lat,
    siteA.long,
    siteB.lat,
    siteB.long,
    renderList.length,
    showFresnelSwath,
    showBeamCones,
    showAuxSites,
  ]);

  // Update Tile Layer when style changes
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    mapInstanceRef.current.removeLayer(tileLayerRef.current);
    const newLayer = L.tileLayer(tileUrls[mapStyle], {
      attribution: tileAttributions[mapStyle],
      maxZoom: 19,
    }).addTo(mapInstanceRef.current);
    tileLayerRef.current = newLayer;
  }, [mapStyle]);

  // Handle Synchronized Probe Distance Pin
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (probeDistanceKm === undefined || probeDistanceKm < 0) {
      if (probeMarkerRef.current) {
        mapInstanceRef.current.removeLayer(probeMarkerRef.current);
        probeMarkerRef.current = null;
      }
      return;
    }

    const frac = Math.max(0, Math.min(1, probeDistanceKm / haversineDistKm));
    const pLat = siteA.lat + frac * (siteB.lat - siteA.lat);
    const pLong = siteA.long + frac * (siteB.long - siteA.long);

    const probeIcon = L.divIcon({
      className: 'fresnel-probe-pin',
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center;">
          <div style="
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #22d3ee;
            border: 2.5px solid #ffffff;
            box-shadow: 0 0 12px #22d3ee;
            animation: pulse 1.5s infinite;
          "></div>
        </div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    if (probeMarkerRef.current) {
      probeMarkerRef.current.setLatLng([pLat, pLong]);
    } else {
      probeMarkerRef.current = L.marker([pLat, pLong], { icon: probeIcon, zIndexOffset: 800 }).addTo(
        mapInstanceRef.current
      );
    }
  }, [probeDistanceKm, haversineDistKm, siteA.lat, siteA.long, siteB.lat, siteB.long]);

  // Fit map bounds
  const handleFitBounds = () => {
    if (!mapInstanceRef.current) return;
    const latLngList: L.LatLngExpression[] = renderList.map((s) => [s.lat, s.long]);
    const bounds = L.latLngBounds(latLngList);
    mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
  };

  return (
    <div className="space-y-2">
      {/* Geodesic & RF Link Telemetry Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 font-bold text-cyan-400">
            <Radio className="w-3.5 h-3.5" />
            DISTANCE: {haversineDistKm.toFixed(2)} km
          </span>
          <span className="text-slate-400 hidden sm:inline">
            Azimuth: A➔B <strong className="text-white">{forwardBearing}°</strong> · B➔A <strong className="text-white">{reverseBearing}°</strong>
          </span>
          <span className="text-emerald-400 font-semibold hidden md:inline">
            ΔAlt: {elevationDelta}m
          </span>
          <span className="text-purple-300 font-semibold hidden lg:inline">
            FSPL: {fsplDb} dB ({freqGhz} GHz)
          </span>
          <span className="text-cyan-300 hidden xl:inline">
            Max F1 Radius: ±{maxF1RadiusM}m
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Map Layer Switcher */}
          <div className="flex items-center rounded bg-slate-900 border border-slate-700 p-0.5">
            {(['DARK', 'SATELLITE', 'TOPO', 'STREET'] as const).map((style) => (
              <button
                key={style}
                onClick={() => setMapStyle(style)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${
                  mapStyle === style
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {style}
              </button>
            ))}
          </div>

          {/* Quick Layer Overlay Toggles */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px]">
            <button
              onClick={() => setShowFresnelSwath(!showFresnelSwath)}
              className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                showFresnelSwath ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'text-slate-500'
              }`}
              title="Toggle Fresnel Zone Ground Footprint Corridor"
            >
              Fresnel Corridor
            </button>
            <button
              onClick={() => setShowBeamCones(!showBeamCones)}
              className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                showBeamCones ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'text-slate-500'
              }`}
              title="Toggle Antenna Radiation Sector Cones"
            >
              Beam Cones
            </button>
          </div>

          {/* Reset / Fit Bounds */}
          <button
            onClick={handleFitBounds}
            title="Reset Zoom to Fit All Sites & Polyline"
            className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Viewport Height Expansion Toggle */}
          <button
            onClick={() => {
              setIsExpanded(!isExpanded);
              setTimeout(() => {
                if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
              }, 150);
            }}
            title={isExpanded ? 'Collapse Map Viewport' : 'Expand Map Viewport'}
            className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hidden sm:block"
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Leaflet Map DOM Viewport */}
      <div
        className={`relative w-full rounded-xl overflow-hidden border border-slate-800 shadow-inner z-0 transition-all duration-300 ${
          isExpanded ? 'h-[500px] sm:h-[580px]' : 'h-80 sm:h-96'
        }`}
      >
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Floating Legend Overlay */}
        <div className="absolute bottom-3 left-3 z-[1000] p-2.5 rounded-lg bg-slate-950/90 backdrop-blur-md border border-slate-800 text-[10px] font-mono text-slate-200 space-y-1 shadow-lg pointer-events-none">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block border border-white" />
            <span>Site A: {siteA.id} ({siteA.elevationM || 32}m AMSL)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block border border-white" />
            <span>Site B: {siteB.id} ({siteB.tower?.heightM || 45.1}m SST · ACL {siteB.approvedAclHeightM || 40.7}m)</span>
          </div>
          {renderList.length > 2 && (
            <div className="flex items-center gap-1.5 text-purple-300">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block border border-white" />
              <span>{renderList.length - 2} Auxiliary Regional Sites</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 border-t-2 border-dashed border-cyan-400 inline-block" />
            <span className="text-cyan-300">
              LOS Beam: {haversineDistKm.toFixed(2)} km ({freqGhz} GHz · XPIC)
            </span>
          </div>
          {showFresnelSwath && (
            <div className="flex items-center gap-1.5 text-cyan-400">
              <span className="w-3 h-2 bg-cyan-500/20 border border-cyan-400 border-dashed inline-block" />
              <span>1st Fresnel Ground Footprint (±{maxF1RadiusM}m)</span>
            </div>
          )}
        </div>
      </div>

      {/* Selected Site Detail Drawer Modal */}
      {selectedSiteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5 space-y-4 text-slate-100 font-sans">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                    selectedSiteModal.id === siteA.id
                      ? 'bg-sky-600 text-white'
                      : selectedSiteModal.id === siteB.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-purple-600 text-white'
                  }`}
                >
                  {selectedSiteModal.role || 'SITE'}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white font-mono">
                    {selectedSiteModal.id} — {selectedSiteModal.name}
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    {selectedSiteModal.ownerTowerProvider} Tower ({selectedSiteModal.siteType})
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSiteModal(null)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Coordinates & Quick Copy */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Decimal Coordinates:</span>
                  <span className="text-white font-bold">
                    {selectedSiteModal.lat.toFixed(5)}°, {selectedSiteModal.long.toFixed(5)}°
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(`${selectedSiteModal.lat}, ${selectedSiteModal.long}`, 'dd')}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-cyan-300 flex items-center gap-1 font-bold"
                >
                  {copiedKey === 'dd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'dd' ? 'Copied' : 'Copy Lat/Long'}</span>
                </button>
              </div>

              {selectedSiteModal.latDms && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">DMS Coordinates:</span>
                    <span className="text-slate-300">
                      {selectedSiteModal.latDms}, {selectedSiteModal.longDms}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(`${selectedSiteModal.latDms}, ${selectedSiteModal.longDms}`, 'dms')}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-cyan-300 flex items-center gap-1 font-bold"
                  >
                    {copiedKey === 'dms' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'dms' ? 'Copied' : 'Copy DMS'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Site Physical Specifications Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Elevation:</span>
                <span className="font-bold text-white">{selectedSiteModal.elevationM} m AMSL</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Tower Structure:</span>
                <span className="font-bold text-white">
                  {selectedSiteModal.tower?.type || 'SST'} ({selectedSiteModal.tower?.heightM || 45}m)
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Access Road & Hauling:</span>
                <span className="text-slate-300">
                  {selectedSiteModal.accessRoad?.haulingMethod} ({selectedSiteModal.accessRoad?.type})
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Keyholder Contact:</span>
                <span className="text-slate-300 truncate block">
                  {selectedSiteModal.keyholder} ({selectedSiteModal.keyholderContact})
                </span>
              </div>
            </div>

            {/* Approved ACL Callout if Site B */}
            {selectedSiteModal.id === siteB.id && siteB.approvedAclHeightM && (
              <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/80 text-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold text-emerald-400 block uppercase">
                    Transport Engineering Approved ACL:
                  </span>
                  <p className="font-bold text-white">
                    {siteB.approvedAclHeightM} m on {siteB.approvedAclLeg || 'Leg C'} (MA12U10W 1.2m Dish)
                  </p>
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              </div>
            )}

            {/* External Navigation Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selectedSiteModal.lat},${selectedSiteModal.long}`}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-xs flex items-center gap-1.5 shadow"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Google Maps Route</span>
                <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
              </a>
              <button
                type="button"
                onClick={() => setSelectedSiteModal(null)}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
