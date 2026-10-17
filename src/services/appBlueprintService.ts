export interface ChangelogEntry {
  id: string;
  version: string;
  title: string;
  description: string;
  timestamp: string;
  author: string;
  category: 'FEATURE' | 'BUGFIX' | 'OPTIMIZATION' | 'SECURITY' | 'ARCHITECTURE';
}

export interface AppBlueprint {
  name: string;
  codeName: string;
  version: string;
  lastUpdated: string;
  description: string;
  architecture: {
    frontend: string;
    backend?: string;
    stateManagement: string;
    storage: string;
    offlineSync: string;
    styling: string;
    buildTool: string;
  };
  modules: Array<{
    id: string;
    name: string;
    description: string;
    keyComponents: string[];
    status: 'ACTIVE' | 'ENHANCED' | 'STABLE';
  }>;
  recentFeatures: Array<{
    title: string;
    description: string;
    module: string;
    implementedAt: string;
  }>;
  databaseSchema: {
    indexedDBTables: string[];
    firestoreCollections: string[];
    offlineQueueActions: string[];
  };
  changelog: ChangelogEntry[];
}

const INITIAL_BLUEPRINT: AppBlueprint = {
  name: 'FieldOps MW - Microwave Link Installation & TSSR Suite',
  codeName: 'fieldops-mw-enterprise',
  version: '3.0.0-enterprise',
  lastUpdated: new Date().toISOString(),
  description: 'Enterprise field operations, microwave link installation, dismantling, troubleshooting, TSSR sign-off, photo evidence categorization, offline synchronization, and audit logging suite for remote tower technicians.',
  architecture: {
    frontend: 'React 19 + TypeScript + Tailwind CSS',
    backend: 'Express 4.21 on Node.js 22 with RESTful endpoints & Server-Side Gemini Proxy',
    stateManagement: 'React Hooks & Reactive Storage Subscriptions',
    storage: 'Dexie.js IndexedDB client edge cache + Server state cache',
    offlineSync: 'Two-way batch replication queue with Google Cloud Firestore master',
    styling: 'Tailwind CSS with Dark/Light Sunlight Mode support for outdoor field operations',
    buildTool: 'Vite with tsx development middleware and full TypeScript type checking'
  },
  modules: [
    {
      id: 'jobs',
      name: 'Work Orders & Installation Wizard',
      description: 'Multi-step microwave link installation checklist, Site A / Site B alignment data, azimuth/elevation calculations, and sign-offs.',
      keyComponents: ['InstallationWizard.tsx', 'WorkOrderList', 'AzimuthCalculator'],
      status: 'ACTIVE'
    },
    {
      id: 'dismantling',
      name: 'Dismantling & Inventory Return',
      description: 'Asset recovery, QR/Barcode scanner integration for serial number and asset tag auto-population, and return manifest generation.',
      keyComponents: ['DismantlingModule.tsx', 'BarcodeScannerModal.tsx', 'AssetRecoveryLog'],
      status: 'ENHANCED'
    },
    {
      id: 'troubleshooting',
      name: 'Troubleshooting & Battery Storage Cache',
      description: 'Diagnostic ticketing, RF signal degradation analysis, and Recharts 24-hour historical battery discharge curve monitoring.',
      keyComponents: ['TroubleshootingModule.tsx', 'BatteryDischargeChart.tsx', 'TicketLogger'],
      status: 'ENHANCED'
    },
    {
      id: 'photos',
      name: 'Photo Evidence Engine',
      description: 'Field photo capture with category tagging (Antenna, Coaxial, Grounding, Tower ID) and ReportExportModal PDF category selection.',
      keyComponents: ['PhotoEngine.tsx', 'ReportExportModal.tsx', 'CategorySelector'],
      status: 'ENHANCED'
    },
    {
      id: 'dashboard',
      name: 'Dashboard & Offline Data Audit',
      description: 'KPI summary metrics, microwave hop topology map, security audit trail, and dedicated Offline Data Audit view for IndexedDB troubleshooting.',
      keyComponents: ['Dashboard.tsx', 'OfflineDataAudit.tsx', 'QueueInspector'],
      status: 'ENHANCED'
    },
    {
      id: 'tssr',
      name: 'TSSR Approval Sheets',
      description: 'Tower Site Survey Report technical parameters, structural load checks, and digital approvals.',
      keyComponents: ['TssrModule.tsx', 'ApprovalForm'],
      status: 'ACTIVE'
    }
  ],
  recentFeatures: [
    {
      title: 'Report PDF Photo Category Selection',
      description: 'Added granular category filtering in ReportExportModal to select specific photo evidence categories for as-built PDFs.',
      module: 'photos',
      implementedAt: '2026-10-11'
    },
    {
      title: 'QR & Barcode Scanner for Inventory',
      description: 'Integrated mobile camera QR and barcode scanner for instant serial number and asset tag population during equipment returns.',
      module: 'dismantling',
      implementedAt: '2026-10-11'
    },
    {
      title: '24-Hour Battery Discharge Curve',
      description: 'Integrated Recharts line graph in Troubleshooting module displaying historical battery voltage/load discharge over 24 hours.',
      module: 'troubleshooting',
      implementedAt: '2026-10-11'
    },
    {
      title: 'Offline Data Audit View',
      description: 'Created comprehensive offline queue audit view in Dashboard listing IndexedDB items, sync status, timestamps, and error diagnostics.',
      module: 'dashboard',
      implementedAt: '2026-10-11'
    },
    {
      title: 'Autonomous Application Blueprint',
      description: 'Created core application blueprint file with auto-updating changelog and architectural metadata store.',
      module: 'architecture',
      implementedAt: '2026-10-12'
    }
  ],
  databaseSchema: {
    indexedDBTables: ['workOrders', 'sites', 'hops', 'photos', 'inventory', 'tickets', 'tssrApprovals', 'offlineQueue', 'batteryStorageCache'],
    firestoreCollections: ['work_orders', 'sites', 'hops', 'photos', 'inventory_returns', 'troubleshooting_tickets', 'tssr_approvals'],
    offlineQueueActions: ['SAVE_STEP', 'UPLOAD_PHOTO', 'CREATE_TICKET', 'RETURN_ASSET', 'UPDATE_TSSR']
  },
  changelog: [
    {
      id: 'ch-005',
      version: '2.5.0',
      title: 'Autonomous Application Blueprint & Changelog Tracker',
      description: 'Introduced self-updating application blueprint file storing architecture details, modules, features, and automatic update history.',
      timestamp: new Date().toISOString(),
      author: 'Senior Full-Stack Developer',
      category: 'ARCHITECTURE'
    },
    {
      id: 'ch-004',
      version: '2.4.0',
      title: 'Offline Data Audit & IndexedDB Queue Inspector',
      description: 'Added dedicated Offline Data Audit view to Dashboard with sync status badges, timestamps, error diagnostics, and retry tools.',
      timestamp: '2026-10-11T14:00:00Z',
      author: 'Senior Full-Stack Developer',
      category: 'FEATURE'
    },
    {
      id: 'ch-003',
      version: '2.3.0',
      title: 'Recharts 24-Hour Battery Discharge Curve',
      description: 'Added interactive battery discharge historical line chart in Troubleshooting module powered by local storage cache.',
      timestamp: '2026-10-11T12:00:00Z',
      author: 'Senior Full-Stack Developer',
      category: 'FEATURE'
    },
    {
      id: 'ch-002',
      version: '2.2.0',
      title: 'QR & Barcode Scanner for Equipment Returns',
      description: 'Integrated camera-based barcode and QR scanner for instantaneous asset tag and serial number data entry.',
      timestamp: '2026-10-11T10:00:00Z',
      author: 'Senior Full-Stack Developer',
      category: 'FEATURE'
    },
    {
      id: 'ch-000-weather-sync-progress',
      version: '3.7.0',
      title: 'Visual Offline Queue Progress Indicator & Localized Weather Forecast Widget with Enterprise Layout Sidebar',
      description: 'Implemented modern enterprise layout featuring a decorative microwave telemetry branding sidebar for desktop/tablet viewports. Built a visual progress indicator in the SyncModal showing granular percentage meters for batched photo uploads and data synchronizations. Integrated a localized weather forecast widget into the Operations Dashboard and Pre-Climb Safety Modal using browser geolocation and Open-Meteo API to deliver critical wind speed (with 45m mast shear calculation), line-of-sight visibility, thunderstorm perimeter gating, and 6-hour climbing window forecasts.',
      timestamp: new Date().toISOString(),
      author: 'Principal Full-Stack Architect',
      category: 'FEATURE'
    },
    {
      id: 'ch-000-battery-telemetry',
      version: '3.6.0',
      title: 'BatteryTelemetry™: Web Battery API Integration & Tower Discharge Safety Alerts',
      description: 'Created the BatteryTelemetry component integrating the Web Battery API to monitor technician handheld battery discharge rates, health metrics, and outdoor thermal status during long tower rigging sessions. Features multi-tier alert thresholds (25% Advisory, 15% Critical Tower Descent, 8% Emergency Cutoff), rolling Recharts discharge curve, audible synthesis chimes, haptic vibration warnings, power-saving recommendations, emergency local edge data flush, and full manual simulation controls.',
      timestamp: new Date().toISOString(),
      author: 'Senior Full-Stack Developer',
      category: 'FEATURE'
    },
    {
      id: 'ch-000-haptic-feedback',
      version: '3.5.0',
      title: 'Haptic Feedback Engine for Optimal Antenna Orientation (≤0.5° Boresight Lock)',
      description: 'Implemented hardware haptic feedback using navigator.vibrate when the antenna orientation enters the optimal tolerance window (within 0.5 degrees of target azimuth and elevation). Includes cadence pulses, visual tactile ripple effects, on/off toggle button, and manual simulation calibration sliders.',
      timestamp: new Date().toISOString(),
      author: 'Senior Full-Stack Developer',
      category: 'FEATURE'
    },
    {
      id: 'ch-000-recharts-trend',
      version: '3.4.0',
      title: 'Real-Time 30-Second Stabilization Trend Recharts Line Chart in AlignmentEngine',
      description: 'Implemented a high-performance 1 Hz live rolling 30-second telemetry line chart with Recharts ComposedChart. Visualizes multi-axis stabilization trend (0-100% Stability Score, Azimuth Error, Elevation Tilt Error, and Accelerometer Vibration), 30s aggregate KPI metrics, pause/resume streaming controls, and custom dark-glass tooltips.',
      timestamp: '2026-10-15T05:25:00Z',
      author: 'Senior Full-Stack Developer',
      category: 'FEATURE'
    },
    {
      id: 'ch-000-alignment-engine',
      version: '3.3.0',
      title: 'AlignmentEngine™: Accelerometer & Gyroscope Sensor HUD with Data Logging',
      description: 'Created the AlignmentEngine component utilizing device accelerometer, gyroscope, and orientation APIs for real-time visual guidance during antenna alignment. Features stability scoring, vibration/sway monitoring, audio/haptic feedback, session recording, and JSON session export.',
      timestamp: '2026-10-14T03:23:00Z',
      author: 'Senior Full-Stack Developer',
      category: 'FEATURE'
    },
    {
      id: 'ch-000-sensor',
      version: '3.2.0',
      title: 'Real-Time Mobile Device Sensor Alignment Tool (Compass & Inclinometer HUD)',
      description: 'Integrated live hardware orientation engine (DeviceOrientationEvent & webkitCompassHeading) for high-precision antenna bore-sight alignment. Features target lock-on (±1.0° tolerance), inclinometer bubble tilt indicator, Web Audio synthesize feedback chirps, and manual slider fallback.',
      timestamp: new Date().toISOString(),
      author: 'Senior Full-Stack Developer',
      category: 'FEATURE'
    },
    {
      id: 'ch-000-audit',
      version: '3.1.0',
      title: 'Full Codebase Audit, Bug Fixes & Dead Code Elimination',
      description: 'Performed comprehensive backend and frontend audit: eliminated redundant indexedDbService and legacy idb dependency, removed unused ProtectedAction dead code, fixed audit log target mapping, guarded localStorage in weatherService, implemented deleteDoc in Firestore sync, and supported full mutation batches.',
      timestamp: '2026-10-12T14:23:00Z',
      author: 'Senior Backend Developer',
      category: 'OPTIMIZATION'
    },
    {
      id: 'ch-000-backend',
      version: '3.0.0',
      title: 'Enterprise Server Architecture, RESTful APIs & Multi-Tier Cloud Infrastructure',
      description: 'Implemented high-performance Express 4.21 backend (server.ts) with deep health probes, observability metrics, state-machine validation, battery discharge telemetry cache, server-side Gemini AI key vault proxy, and multi-tier Dexie-to-Firestore synchronization.',
      timestamp: '2026-10-12T14:07:00Z',
      author: 'Senior Backend Developer',
      category: 'ARCHITECTURE'
    },
    {
      id: 'ch-000-flow',
      version: '2.7.2',
      title: 'Optimized User Flow & Accessibility (Login > Dashboard > Jobs > Steps)',
      description: 'Streamlined application navigation to strictly follow Login Page -> Dashboard (Landing Page) -> Jobs -> Steps, complete with ARIA labels, focus states, high contrast, and workflow guidance banners.',
      timestamp: '2026-10-12T08:10:00Z',
      author: 'Senior Full-Stack Developer',
      category: 'OPTIMIZATION'
    },
    {
      id: 'ch-000-rbac',
      version: '2.7.1',
      title: 'Strict RBAC Enforcement on High-Altitude Tower Tasks',
      description: 'Implemented rigorous Role-Based Access Control (RBAC) across wizard steps. For example, users logged in as Technicians are securely blocked from accessing Tower Climber high-altitude rigging tasks with a professional clearance gate.',
      timestamp: '2026-10-12T07:58:00Z',
      author: 'Senior Full-Stack Developer',
      category: 'SECURITY'
    },
    {
      id: 'ch-000-login',
      version: '2.7.0',
      title: 'Multi-Role Secure Login & Authentication Portal',
      description: 'Created comprehensive Login Page supporting Technician, Tower Climber, Supervisor, Reviewer, Project Manager, and Admin roles with RBAC privilege previews and themed UI/UX.',
      timestamp: '2026-10-12T07:39:00Z',
      author: 'Senior Full-Stack Developer',
      category: 'FEATURE'
    },
    {
      id: 'ch-000',
      version: '2.6.0',
      title: 'Pre-Climb Safety Check & Hazard Briefing Modal',
      description: 'Added mandatory Pre-Climb Safety Check modal appearing when starting work orders, verifying PPE and site-specific RF/electrical/structural hazards.',
      timestamp: '2026-10-12T07:39:00Z',
      author: 'Senior Full-Stack Developer',
      category: 'FEATURE'
    },
    {
      id: 'ch-001',
      version: '2.1.0',
      title: 'Photo Evidence Category Selection for PDF Reports',
      description: 'Added selective photo category checkboxes in ReportExportModal for customized as-built PDF generation.',
      timestamp: '2026-10-11T08:00:00Z',
      author: 'Senior Full-Stack Developer',
      category: 'FEATURE'
    }
  ]
};

class AppBlueprintService {
  private blueprint: AppBlueprint;
  private listeners: Array<() => void> = [];

  constructor() {
    const saved = localStorage.getItem('fieldops_mw_blueprint');
    if (saved) {
      try {
        this.blueprint = JSON.parse(saved);
      } catch {
        this.blueprint = INITIAL_BLUEPRINT;
      }
    } else {
      this.blueprint = INITIAL_BLUEPRINT;
      this.persist();
    }
  }

  private persist() {
    try {
      localStorage.setItem('fieldops_mw_blueprint', JSON.stringify(this.blueprint, null, 2));
    } catch (e) {
      console.error('Failed to save blueprint to localStorage', e);
    }
  }

  public getBlueprint(): AppBlueprint {
    return this.blueprint;
  }

  public logUpdate(entry: Omit<ChangelogEntry, 'id' | 'timestamp'>) {
    const newEntry: ChangelogEntry = {
      ...entry,
      id: `ch-${Date.now().toString(36)}`,
      timestamp: new Date().toISOString()
    };

    this.blueprint.changelog = [newEntry, ...this.blueprint.changelog];
    this.blueprint.lastUpdated = new Date().toISOString();
    
    if (entry.category === 'FEATURE') {
      this.blueprint.recentFeatures = [
        {
          title: entry.title,
          description: entry.description,
          module: 'system',
          implementedAt: new Date().toISOString().split('T')[0]
        },
        ...this.blueprint.recentFeatures
      ];
    }

    this.persist();
    this.notifyListeners();
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l());
  }
}

export const appBlueprintService = new AppBlueprintService();
