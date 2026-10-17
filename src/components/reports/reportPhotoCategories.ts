import { PhotoEvidence, Site, Hop, UserProfile } from '../../types/fieldops';

export interface PhotoCategoryDefinition {
  id: string;
  name: string;
  shortName: string;
  description: string;
  iconName: 'Truck' | 'Layers' | 'Radio' | 'Zap' | 'Shield' | 'Server' | 'Compass';
  sectionCodes: string[];
  defaultSelected: boolean;
  priority: number;
}

export const PHOTO_CATEGORIES: PhotoCategoryDefinition[] = [
  {
    id: 'ANTENNA_RF',
    name: 'Antenna Mount & RF Boresight',
    shortName: 'Antenna & RF',
    description: '1.2m dish mounting at 40.7m ACL, antenna serial tag, azimuth compass heading (241°), and AMB bracket condition',
    iconName: 'Radio',
    sectionCodes: ['1.5_AMB_LOCATION', '1.6_PROPOSED_ANTENNA', '1.19_ANTENNA_LABEL', '1.20_AZIMUTH_COMPASS'],
    defaultSelected: true,
    priority: 1,
  },
  {
    id: 'POWER_CABINET',
    name: 'Power System & ODC Cabinet',
    shortName: 'Power & Cabinet',
    description: 'Outdoor cabinet pad, -48V DC rectifier panel, battery string health, DCPDB circuit breaker, and multimeter tests',
    iconName: 'Zap',
    sectionCodes: ['1.11_ODC_PAD', '1.12_RECTIFIER_NAMEPLATE', '1.13_BATTERY_BANK', '1.14_DCPDB_BREAKER', '1.15_POLARITY_CHECK', '1.21_GENSET_ATS'],
    defaultSelected: true,
    priority: 2,
  },
  {
    id: 'GROUNDING_FEEDERS',
    name: 'Grounding & Feeder Weatherproofing',
    shortName: 'Grounding & Cables',
    description: 'Upper 40.3m & base busbar lugs (16mm²), 3-3-2 vulcanized weatherproofing, and IF cable ladder clamps',
    iconName: 'Shield',
    sectionCodes: ['1.8_CABLE_TRAY', '1.9_UPPER_BUSBAR', '1.10_BASE_BUSBAR', '1.17_ODU_WEATHERPROOFING', '1.18_GROUNDING_KITS'],
    defaultSelected: true,
    priority: 3,
  },
  {
    id: 'TRANSMISSION_IDU',
    name: 'Transmission Indoor Unit (IDU)',
    shortName: 'IDU NR9150',
    description: 'OptiX RTN 9150 shelf mounted in 19-inch rack, power terminal block, and IF coaxial port terminations',
    iconName: 'Server',
    sectionCodes: ['1.16_IDU_RACK'],
    defaultSelected: true,
    priority: 4,
  },
  {
    id: 'TOWER_STRUCTURE',
    name: 'Tower & Structural Mounts',
    shortName: 'Tower Structure',
    description: 'Full lattice tower elevation view, leg foundation anchor bolts, and caliper leg diameter measurement',
    iconName: 'Layers',
    sectionCodes: ['1.3_TOWER_WHOLE', '1.4_TOWER_BASE', '1.7_LEG_DIAMETER'],
    defaultSelected: true,
    priority: 5,
  },
  {
    id: 'CIVIL_ACCESS',
    name: 'Civil Works & Site Access',
    shortName: 'Civil & Access',
    description: 'Access road haulage trail, site compound perimeter fence, and clean post-installation site turnover',
    iconName: 'Truck',
    sectionCodes: ['1.1_ACCESS', '1.2_SITE_COMPOUND', '1.22_SITE_HANDOVER'],
    defaultSelected: false,
    priority: 6,
  },
  {
    id: 'PANORAMA_360',
    name: '360° Horizon Panoramas',
    shortName: '360° Panoramas',
    description: 'Panoramic line-of-sight visual sweeps (0° to 330°) auditing Fresnel zone clearances and topography',
    iconName: 'Compass',
    sectionCodes: [
      'PANORAMA_000', 'PANORAMA_030', 'PANORAMA_060', 'PANORAMA_090',
      'PANORAMA_120', 'PANORAMA_150', 'PANORAMA_180', 'PANORAMA_210',
      'PANORAMA_240', 'PANORAMA_270', 'PANORAMA_300', 'PANORAMA_330',
    ],
    defaultSelected: false,
    priority: 7,
  },
];

export function getCategoryForSection(sectionCode: string): PhotoCategoryDefinition {
  if (sectionCode.startsWith('PANORAMA')) {
    return PHOTO_CATEGORIES.find((c) => c.id === 'PANORAMA_360')!;
  }
  const match = PHOTO_CATEGORIES.find((cat) =>
    cat.sectionCodes.some((code) => sectionCode.startsWith(code) || code.startsWith(sectionCode))
  );
  if (match) return match;

  // Prefix fallback matching
  if (sectionCode.startsWith('1.5') || sectionCode.startsWith('1.6') || sectionCode.startsWith('1.19') || sectionCode.startsWith('1.20')) {
    return PHOTO_CATEGORIES.find((c) => c.id === 'ANTENNA_RF')!;
  }
  if (sectionCode.startsWith('1.11') || sectionCode.startsWith('1.12') || sectionCode.startsWith('1.13') || sectionCode.startsWith('1.14') || sectionCode.startsWith('1.15') || sectionCode.startsWith('1.21')) {
    return PHOTO_CATEGORIES.find((c) => c.id === 'POWER_CABINET')!;
  }
  if (sectionCode.startsWith('1.8') || sectionCode.startsWith('1.9') || sectionCode.startsWith('1.10') || sectionCode.startsWith('1.17') || sectionCode.startsWith('1.18')) {
    return PHOTO_CATEGORIES.find((c) => c.id === 'GROUNDING_FEEDERS')!;
  }
  if (sectionCode.startsWith('1.16')) {
    return PHOTO_CATEGORIES.find((c) => c.id === 'TRANSMISSION_IDU')!;
  }
  if (sectionCode.startsWith('1.3') || sectionCode.startsWith('1.4') || sectionCode.startsWith('1.7')) {
    return PHOTO_CATEGORIES.find((c) => c.id === 'TOWER_STRUCTURE')!;
  }
  return PHOTO_CATEGORIES.find((c) => c.id === 'CIVIL_ACCESS')!;
}

// Helper to generate simulated SVG telecom photo data URL with watermark
function createSimulatedSvgPhoto(
  title: string,
  sectionCode: string,
  siteId: string,
  siteName: string,
  lat: number,
  long: number,
  dateStr: string,
  techName: string,
  details: { label1: string; val1: string; label2: string; val2: string; themeColor: string }
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 480" width="800" height="480">
  <defs>
    <linearGradient id="bg_${sectionCode.replace(/[^a-zA-Z0-9]/g, '_')}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#09131e"/>
      <stop offset="50%" stop-color="#142436"/>
      <stop offset="100%" stop-color="#020810"/>
    </linearGradient>
    <pattern id="grid_${sectionCode.replace(/[^a-zA-Z0-9]/g, '_')}" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e3247" stroke-width="0.8"/>
    </pattern>
  </defs>

  <rect width="800" height="480" fill="url(#bg_${sectionCode.replace(/[^a-zA-Z0-9]/g, '_')})"/>
  <rect width="800" height="480" fill="url(#grid_${sectionCode.replace(/[^a-zA-Z0-9]/g, '_')})"/>

  <!-- Technical Framing Reticle -->
  <circle cx="400" cy="210" r="140" fill="none" stroke="${details.themeColor}" stroke-width="1.5" stroke-dasharray="8 4" opacity="0.4"/>
  <circle cx="400" cy="210" r="6" fill="${details.themeColor}" opacity="0.8"/>
  <line x1="230" y1="210" x2="270" y2="210" stroke="${details.themeColor}" stroke-width="2"/>
  <line x1="530" y1="210" x2="570" y2="210" stroke="${details.themeColor}" stroke-width="2"/>
  <line x1="400" y1="50" x2="400" y2="90" stroke="${details.themeColor}" stroke-width="2"/>
  <line x1="400" y1="330" x2="400" y2="370" stroke="${details.themeColor}" stroke-width="2"/>

  <!-- Field Verification Icon & Badge -->
  <rect x="50" y="40" width="700" height="42" rx="6" fill="#030b14" fill-opacity="0.85" stroke="#1e3a5a" stroke-width="1"/>
  <text x="70" y="67" font-family="monospace" font-size="16" font-weight="bold" fill="#38bdf8">EVIDENCE CODE: ${sectionCode}</text>
  <text x="440" y="67" font-family="monospace" font-size="14" fill="#94a3b8">QA STATUS: <tspan fill="#34d399" font-weight="bold">AI VERIFIED [PASS]</tspan></text>

  <!-- Central Graphic Subject Description -->
  <rect x="180" y="140" width="440" height="140" rx="8" fill="#05101a" fill-opacity="0.9" stroke="${details.themeColor}" stroke-width="1.5"/>
  <text x="400" y="178" font-family="sans-serif" font-size="18" font-weight="bold" fill="#ffffff" text-anchor="middle">${title.toUpperCase()}</text>
  <text x="400" y="206" font-family="monospace" font-size="13" fill="${details.themeColor}" text-anchor="middle">${details.label1}: ${details.val1}</text>
  <text x="400" y="230" font-family="monospace" font-size="13" fill="#cbd5e1" text-anchor="middle">${details.label2}: ${details.val2}</text>
  <text x="400" y="258" font-family="sans-serif" font-size="11" fill="#64748b" text-anchor="middle">AS-BUILT QA SPECIFICATION VERIFIED AGAINST TSSR</text>

  <!-- Burned-in HUD Watermark Footer Banner -->
  <rect x="0" y="400" width="800" height="80" fill="#020617" fill-opacity="0.95"/>
  <line x1="0" y1="400" x2="800" y2="400" stroke="#06b6d4" stroke-width="2.5"/>

  <text x="24" y="430" font-family="monospace" font-size="15" font-weight="bold" fill="#ffffff">FIELDOPS MW  |  ${siteId}  |  ${sectionCode}</text>
  <text x="24" y="456" font-family="monospace" font-size="12" fill="#38bdf8">${siteName}  ·  TECH: ${techName}</text>

  <text x="776" y="430" font-family="monospace" font-size="13" font-weight="bold" fill="#e2e8f0" text-anchor="end">${dateStr}</text>
  <text x="776" y="456" font-family="monospace" font-size="12" fill="#34d399" text-anchor="end">GPS: ${lat.toFixed(5)}°N, ${long.toFixed(5)}°E  ·  AZ: 241.0°</text>
</svg>`;

  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

// Generate realistic telecom sample photos for all categories
export function generateRealisticSamplePhotos(
  site: Site,
  hop: Hop,
  activeUser: UserProfile
): PhotoEvidence[] {
  const dateStr = '2026-10-11 08:30:14 UTC+8';
  const lat = site.lat;
  const long = site.long;

  return [
    {
      id: 'sample-photo-1.6',
      orgId: activeUser.orgId,
      siteId: site.id,
      sectionCode: '1.6_PROPOSED_ANTENNA',
      sectionTitle: '1.6 Proposed Antenna Position (Height & Leg)',
      caption: '1.2m MA12U10W dish mounted on Leg C at approved 40.7m centerline height with AMB brackets.',
      dataUrl: createSimulatedSvgPhoto(
        '1.2m Parabolic Dish on Leg C',
        '1.6_PROPOSED_ANTENNA',
        site.id,
        site.name,
        lat,
        long,
        dateStr,
        activeUser.name,
        {
          label1: 'Antenna Height',
          val1: `${site.approvedAclHeightM || 40.7}m ACL (Variance: 0.0m)`,
          label2: 'Leg Position',
          val2: `${site.approvedAclLeg || 'Leg C'} tubular member (Ø114mm)`,
          themeColor: '#06b6d4',
        }
      ),
      capturedAt: '2026-10-11T08:30:14Z',
      capturedBy: activeUser.name,
      gpsLat: lat,
      gpsLong: long,
      azimuthDeg: 241.0,
      aiVerification: {
        verified: true,
        score: 98,
        feedback: 'Antenna position verified on Leg C at 40.7m ACL. Clear line-of-sight confirmed.',
      },
      syncStatus: 'SYNCED',
    },
    {
      id: 'sample-photo-1.20',
      orgId: activeUser.orgId,
      siteId: site.id,
      sectionCode: '1.20_AZIMUTH_COMPASS',
      sectionTitle: '1.20 Alignment Azimuth Compass Verification',
      caption: 'Optical compass sighting aligned to 241.0° boresight heading towards Site A.',
      dataUrl: createSimulatedSvgPhoto(
        'Boresight Azimuth Compass 241°',
        '1.20_AZIMUTH_COMPASS',
        site.id,
        site.name,
        lat,
        long,
        dateStr,
        activeUser.name,
        {
          label1: 'Planned Azimuth',
          val1: '241.02° True North',
          label2: 'Measured Alignment',
          val2: '241.0° (RSL: -27.20 dBm peaked)',
          themeColor: '#38bdf8',
        }
      ),
      capturedAt: '2026-10-11T08:35:22Z',
      capturedBy: activeUser.name,
      gpsLat: lat,
      gpsLong: long,
      azimuthDeg: 241.0,
      aiVerification: {
        verified: true,
        score: 96,
        feedback: 'Azimuth alignment within ±0.1° engineering tolerance.',
      },
      syncStatus: 'SYNCED',
    },
    {
      id: 'sample-photo-1.19',
      orgId: activeUser.orgId,
      siteId: site.id,
      sectionCode: '1.19_ANTENNA_LABEL',
      sectionTitle: '1.19 Antenna Label & Serial Number Plate',
      caption: 'Nameplate serial plate of 1.2m dish (MA12U10W, S/N: ANT-MA12-99042).',
      dataUrl: createSimulatedSvgPhoto(
        'Antenna Nameplate & Serial Tag',
        '1.19_ANTENNA_LABEL',
        site.id,
        site.name,
        lat,
        long,
        dateStr,
        activeUser.name,
        {
          label1: 'Antenna Model',
          val1: 'MA12U10W 1.2m (40.2 dBi gain)',
          label2: 'Serial Number',
          val2: 'ANT-MA12-99042 / AST-ANT-12-884',
          themeColor: '#3b82f6',
        }
      ),
      capturedAt: '2026-10-11T08:38:00Z',
      capturedBy: activeUser.name,
      gpsLat: lat,
      gpsLong: long,
      azimuthDeg: 241.0,
      aiVerification: {
        verified: true,
        score: 99,
        feedback: 'Serial number OCR matched BOM record AST-ANT-12-884.',
      },
      syncStatus: 'SYNCED',
    },
    {
      id: 'sample-photo-1.12',
      orgId: activeUser.orgId,
      siteId: site.id,
      sectionCode: '1.12_RECTIFIER_NAMEPLATE',
      sectionTitle: '1.12 Rectifier Nameplate & Modules',
      caption: '-48V DC power system energization test. Measured -48.25V DC at DC busbar.',
      dataUrl: createSimulatedSvgPhoto(
        '-48V DC Rectifier System Test',
        '1.12_RECTIFIER_NAMEPLATE',
        site.id,
        site.name,
        lat,
        long,
        dateStr,
        activeUser.name,
        {
          label1: 'Rectifier Output',
          val1: '-48.25 VDC (Nominal -48V)',
          label2: 'Active Modules',
          val2: '2x 50A Rectifier Modules healthy',
          themeColor: '#eab308',
        }
      ),
      capturedAt: '2026-10-11T08:42:10Z',
      capturedBy: activeUser.name,
      gpsLat: lat,
      gpsLong: long,
      aiVerification: {
        verified: true,
        score: 97,
        feedback: 'DC power levels compliant with RTN 9150 input range (-38.4V to -57.6V).',
      },
      syncStatus: 'SYNCED',
    },
    {
      id: 'sample-photo-1.14',
      orgId: activeUser.orgId,
      siteId: site.id,
      sectionCode: '1.14_DCPDB_BREAKER',
      sectionTitle: '1.14 DCPDB MW Breaker Slot & Rating',
      caption: 'Dedicated 32A DC circuit breaker labeled "MW-RTN9150-PRI" on DCPDB panel.',
      dataUrl: createSimulatedSvgPhoto(
        'DCPDB Microwave 32A Breaker',
        '1.14_DCPDB_BREAKER',
        site.id,
        site.name,
        lat,
        long,
        dateStr,
        activeUser.name,
        {
          label1: 'Breaker Slot',
          val1: 'Slot CB-07 (32A Curve C DC)',
          label2: 'Label Tag',
          val2: 'MW-RTN9150-PRI / -48V DC',
          themeColor: '#f59e0b',
        }
      ),
      capturedAt: '2026-10-11T08:45:00Z',
      capturedBy: activeUser.name,
      gpsLat: lat,
      gpsLong: long,
      aiVerification: {
        verified: true,
        score: 95,
        feedback: 'Circuit breaker rating verified 32A.',
      },
      syncStatus: 'SYNCED',
    },
    {
      id: 'sample-photo-1.9',
      orgId: activeUser.orgId,
      siteId: site.id,
      sectionCode: '1.9_UPPER_BUSBAR',
      sectionTitle: '1.9 Upper Busbar Grounding (40.3m)',
      caption: '16mm² copper grounding lead bonded to tower busbar with double-hole lug and anti-oxidation grease.',
      dataUrl: createSimulatedSvgPhoto(
        'Upper Tower Busbar Grounding',
        '1.9_UPPER_BUSBAR',
        site.id,
        site.name,
        lat,
        long,
        dateStr,
        activeUser.name,
        {
          label1: 'Busbar Elevation',
          val1: '40.3m on Tower Leg C',
          label2: 'Cable Spec',
          val2: '16 mm² stranded Cu + 2-hole lug',
          themeColor: '#10b981',
        }
      ),
      capturedAt: '2026-10-11T08:50:30Z',
      capturedBy: activeUser.name,
      gpsLat: lat,
      gpsLong: long,
      aiVerification: {
        verified: true,
        score: 99,
        feedback: 'Two-hole compression lug torqued with Belleville spring washers.',
      },
      syncStatus: 'SYNCED',
    },
    {
      id: 'sample-photo-1.17',
      orgId: activeUser.orgId,
      siteId: site.id,
      sectionCode: '1.17_ODU_WEATHERPROOFING',
      sectionTitle: '1.17 ODU & IF Cable Weatherproofing 3-3-2',
      caption: '3-3-2 vulcanized rubber tape wrap inspected on ODU IF N-connector.',
      dataUrl: createSimulatedSvgPhoto(
        '3-3-2 Weatherproofing Seal',
        '1.17_ODU_WEATHERPROOFING',
        site.id,
        site.name,
        lat,
        long,
        dateStr,
        activeUser.name,
        {
          label1: 'Wrapping Method',
          val1: '3 PVC + 3 Rubber Mastic + 2 UV Wrap',
          label2: 'Inspection',
          val2: 'Hermetic seal certified (IP68)',
          themeColor: '#059669',
        }
      ),
      capturedAt: '2026-10-11T08:54:12Z',
      capturedBy: activeUser.name,
      gpsLat: lat,
      gpsLong: long,
      aiVerification: {
        verified: true,
        score: 96,
        feedback: 'Weatherproofing layers compliant with Globe/Smart MW technical standard.',
      },
      syncStatus: 'SYNCED',
    },
    {
      id: 'sample-photo-1.16',
      orgId: activeUser.orgId,
      siteId: site.id,
      sectionCode: '1.16_IDU_RACK',
      sectionTitle: '1.16 IDU NR9150 Rack Mount Position',
      caption: 'OptiX RTN 9150 chassis installed in 1U slot of telecom rack with grounding wire bonded.',
      dataUrl: createSimulatedSvgPhoto(
        'Huawei OptiX RTN 9150 IDU',
        '1.16_IDU_RACK',
        site.id,
        site.name,
        lat,
        long,
        dateStr,
        activeUser.name,
        {
          label1: 'Chassis Position',
          val1: 'ODC Rack Unit 14 (1U standard)',
          label2: 'Cabling',
          val2: 'Dual IF Cables + 10mm² rack ground',
          themeColor: '#6366f1',
        }
      ),
      capturedAt: '2026-10-11T08:58:00Z',
      capturedBy: activeUser.name,
      gpsLat: lat,
      gpsLong: long,
      aiVerification: {
        verified: true,
        score: 97,
        feedback: 'IDU secure mounting and cable dress pass QA inspection.',
      },
      syncStatus: 'SYNCED',
    },
    {
      id: 'sample-photo-1.3',
      orgId: activeUser.orgId,
      siteId: site.id,
      sectionCode: '1.3_TOWER_WHOLE',
      sectionTitle: '1.3 Whole Tower Elevation View',
      caption: 'Full elevation view of 45m SST lattice tower from compound southern perimeter.',
      dataUrl: createSimulatedSvgPhoto(
        '45m Lattice Tower Elevation',
        '1.3_TOWER_WHOLE',
        site.id,
        site.name,
        lat,
        long,
        dateStr,
        activeUser.name,
        {
          label1: 'Tower Height',
          val1: `${site.tower.heightM}m SST Tubular (EDOTCO)`,
          label2: 'Structural Status',
          val2: '14.8% spare capacity confirmed',
          themeColor: '#8b5cf6',
        }
      ),
      capturedAt: '2026-10-11T09:02:18Z',
      capturedBy: activeUser.name,
      gpsLat: lat,
      gpsLong: long,
      aiVerification: {
        verified: true,
        score: 94,
        feedback: 'Tower verticality and structural integrity confirmed.',
      },
      syncStatus: 'SYNCED',
    },
    {
      id: 'sample-photo-1.1',
      orgId: activeUser.orgId,
      siteId: site.id,
      sectionCode: '1.1_ACCESS',
      sectionTitle: '1.1 Access Road & Hauling Path',
      caption: 'Access road from provincial road leading to site compound gate.',
      dataUrl: createSimulatedSvgPhoto(
        'Site Access Road & Compound Gate',
        '1.1_ACCESS',
        site.id,
        site.name,
        lat,
        long,
        dateStr,
        activeUser.name,
        {
          label1: 'Road Condition',
          val1: `${site.accessRoad.type} (${site.accessRoad.distanceToMainRoadM}m from highway)`,
          label2: 'Transport Access',
          val2: `${site.accessRoad.haulingMethod} vehicle access cleared`,
          themeColor: '#64748b',
        }
      ),
      capturedAt: '2026-10-11T09:05:00Z',
      capturedBy: activeUser.name,
      gpsLat: lat,
      gpsLong: long,
      aiVerification: {
        verified: true,
        score: 95,
        feedback: 'Access route logged.',
      },
      syncStatus: 'SYNCED',
    },
    {
      id: 'sample-photo-pan-090',
      orgId: activeUser.orgId,
      siteId: site.id,
      sectionCode: 'PANORAMA_090',
      sectionTitle: 'Panorama 90° Heading (East)',
      caption: '90° East horizon survey from tower 40m platform showing clear Fresnel zone.',
      dataUrl: createSimulatedSvgPhoto(
        '360° Panorama - 90° Heading',
        'PANORAMA_090',
        site.id,
        site.name,
        lat,
        long,
        dateStr,
        activeUser.name,
        {
          label1: 'Azimuth Sector',
          val1: '090° True Heading (East-Southeast)',
          label2: 'Obstacle Audit',
          val2: '0 obstruction in 60% 1st Fresnel zone',
          themeColor: '#0ea5e9',
        }
      ),
      capturedAt: '2026-10-11T09:10:00Z',
      capturedBy: activeUser.name,
      gpsLat: lat,
      gpsLong: long,
      azimuthDeg: 90.0,
      aiVerification: {
        verified: true,
        score: 96,
        feedback: 'Line-of-sight sweep validated.',
      },
      syncStatus: 'SYNCED',
    },
  ];
}

// Merge user-captured photos with realistic fallback photos for uncaptured sections
export function getMergedPhotoEvidence(
  capturedPhotos: PhotoEvidence[],
  site: Site,
  hop: Hop,
  activeUser: UserProfile
): PhotoEvidence[] {
  const samples = generateRealisticSamplePhotos(site, hop, activeUser);
  const result: PhotoEvidence[] = [...capturedPhotos];

  // For any sample that isn't already covered by a real photo with same sectionCode, append it
  samples.forEach((sample) => {
    if (!result.some((p) => p.sectionCode === sample.sectionCode)) {
      result.push(sample);
    }
  });

  return result;
}
