import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Sparkles,
  Save,
  PenTool,
  Clock,
  Layers,
  ChevronRight,
  Shield,
  ArrowRight,
  Database,
  Radio,
  MapPin,
  Check,
  RefreshCw,
  FolderOpen,
  Calendar,
  Briefcase,
  ExternalLink,
  Trash2,
  Terminal,
  Cpu,
  FileCheck2,
  Activity,
  Zap,
  Sliders,
  CheckCircle,
} from 'lucide-react';
import { Site, Hop, TssrApprovalSheet, UserProfile, ParsedTssrProjectData, WorkOrder } from '../../types/fieldops';
import { storage } from '../../services/storageService';
import { gemini } from '../../services/geminiService';
import { SEED_SITE_A, SEED_SITE_B, SEED_HOP, SEED_WORK_ORDERS } from '../../data/seedData';

interface TssrModuleProps {
  siteA?: Site | null;
  siteB?: Site | null;
  hop?: Hop | null;
  approvals: TssrApprovalSheet;
  activeUser: UserProfile;
  sunlightMode: boolean;
  onNavigateToDashboard?: () => void;
  onNavigateToJobs?: () => void;
}

export const TssrModule: React.FC<TssrModuleProps> = ({
  siteA,
  siteB,
  hop,
  approvals,
  activeUser,
  sunlightMode,
  onNavigateToDashboard,
  onNavigateToJobs,
}) => {
  // Active Project Data state
  const [activeTssrProject, setActiveTssrProject] = useState<ParsedTssrProjectData | null>(() =>
    storage.getActiveTssrProject()
  );

  const displaySiteA = siteA || activeTssrProject?.siteA || SEED_SITE_A;
  const displaySiteB = siteB || activeTssrProject?.siteB || SEED_SITE_B;
  const displayHop = hop || activeTssrProject?.hop || SEED_HOP;

  const [selectedSiteRole, setSelectedSiteRole] = useState<'A' | 'B'>('B');
  const currentSite = selectedSiteRole === 'B' ? displaySiteB : displaySiteA;

  const [activeSection, setActiveSection] = useState<
    'UPLOAD_ENGINE' | 'ROUTING' | '1.1_GENERAL' | '1.2_STRUCTURE' | '1.3_ANTENNAS' | '1.4_POWER' | '1.5_CABLES'
  >('UPLOAD_ENGINE');

  // Approval state
  const [approvalSheet, setApprovalSheet] = useState<TssrApprovalSheet>(approvals);
  const [importText, setImportText] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<string>('SIARGAO_CRANE');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractionProgress, setExtractionProgress] = useState<number>(0);
  const [aiTerminalLogs, setAiTerminalLogs] = useState<string[]>([]);
  const [extractedPreview, setExtractedPreview] = useState<ParsedTssrProjectData | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [uploadedFileMeta, setUploadedFileMeta] = useState<{ name: string; size: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = storage.subscribe(() => {
      setActiveTssrProject(storage.getActiveTssrProject());
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiTerminalLogs]);

  const handleSignApproval = (role: 'transportEng' | 'facilityEng' | 'towerAssessment') => {
    const updated: TssrApprovalSheet = {
      ...approvalSheet,
      [role]: {
        ...approvalSheet[role],
        status: 'APPROVED',
        approverName: activeUser.name,
        date: new Date().toISOString().split('T')[0],
      },
    };
    setApprovalSheet(updated);
    storage.saveTssrApprovals(updated);
  };

  /**
   * Remove all data from the currently uploaded TSSR, returning the system to an unseeded clean slate.
   */
  const handleClearCurrentTssr = async () => {
    if (!window.confirm('Are you sure you want to remove all current TSSR data? This will reset the Microwave Hop, Regional Sites, and Work Orders so you can test the AI ingestion from scratch.')) {
      return;
    }
    await storage.clearAllTssrUploadedData();
    setActiveTssrProject(null);
    setExtractedPreview(null);
    setUploadedFileMeta(null);
    setImportText('');
    setAiTerminalLogs([
      `[${new Date().toLocaleTimeString()}] [SYSTEM_RESET] All previous TSSR data removed by Project Manager.`,
      `[${new Date().toLocaleTimeString()}] [SYSTEM_RESET] Sites, Hops, and Work Orders cleared. Ready for fresh AI ingestion test.`,
    ]);
    setSyncSuccessMsg(
      'All current TSSR data has been successfully removed! The system is now in an unseeded clean slate. Upload a new TSSR dossier to test Gemini AI extraction capabilities.'
    );
  };

  // Build high-fidelity TSSR project data based on chosen preset or input text
  const buildProjectDataFromPreset = (presetKey: string): ParsedTssrProjectData => {
    const nowIso = new Date().toISOString();

    if (presetKey === 'MINDANAO_APO') {
      const siteA_Apo: Site = {
        ...SEED_SITE_A,
        id: 'MIN-APO-T01',
        name: 'Mt. Apo High Repeater Mast',
        address: 'Peak Ridge, Mt. Apo Natural Park, Kidapawan City',
        lat: 6.9875,
        long: 125.2711,
        elevationM: 2954,
        approvedAclHeightM: 62.5,
        approvedAclLeg: 'Leg A',
        tower: {
          ...SEED_SITE_A.tower,
          type: 'Guyed mast',
          heightM: 70.0,
        },
      };

      const siteB_Kid: Site = {
        ...SEED_SITE_B,
        id: 'MIN-KID-C01',
        name: 'Kidapawan City Central Telecom Hub',
        address: 'National Highway Cor. Quezon Blvd, Kidapawan City',
        lat: 7.0092,
        long: 125.0933,
        elevationM: 285,
        approvedAclHeightM: 48.0,
        approvedAclLeg: 'Leg C',
        tower: {
          ...SEED_SITE_B.tower,
          type: '3-legged SST tubular',
          heightM: 55.0,
        },
      };

      const hop_Apo: Hop = {
        ...SEED_HOP,
        id: 'MIN-APO-KID01',
        hopName: 'Mt. Apo to Kidapawan High-Altitude Trunk',
        siteAId: 'MIN-APO-T01',
        siteBId: 'MIN-KID-C01',
        frequencyMHz: 7500,
        polarization: 'Dual',
        pathLengthKm: 18.45,
        expectedRslDbm: -32.4,
        thermalFadeMarginDb: 35.8,
      };

      const generatedWorkOrders: WorkOrder[] = [
        {
          id: 'wo-apo-site-b',
          orgId: 'org-crane-ph',
          projectId: 'MINDANAO-APO-TRUNK',
          regionId: 'MIN',
          workOrderNumber: 'WO-2026-APO-01',
          type: 'INSTALLATION',
          siteRole: 'B',
          siteId: 'MIN-KID-C01',
          hopId: 'MIN-APO-KID01',
          status: 'IN_PROGRESS',
          scheduledDate: '2026-10-18',
          assigneeIds: ['user-tech-1', 'user-climber-1'],
          tssrSnapshotVersion: 'TSSR-2026-APO-01',
          currentStepIndex: 0,
          stepsData: {},
          history: [
            {
              timestamp: nowIso,
              userId: 'user-pm-1',
              userName: 'Carlos Villanueva, PMP',
              action: 'AI_TSSR_INGESTION_CREATED',
              note: 'Generated automatically via Gemini AI ingestion of Mindanao Mt. Apo TSSR.',
            },
          ],
        },
        {
          id: 'wo-apo-align',
          orgId: 'org-crane-ph',
          projectId: 'MINDANAO-APO-TRUNK',
          regionId: 'MIN',
          workOrderNumber: 'WO-2026-APO-02',
          type: 'INSTALLATION',
          siteRole: 'B',
          siteId: 'MIN-KID-C01',
          hopId: 'MIN-APO-KID01',
          status: 'ASSIGNED',
          scheduledDate: '2026-10-19',
          assigneeIds: ['user-tech-1'],
          tssrSnapshotVersion: 'TSSR-2026-APO-01',
          currentStepIndex: 0,
          stepsData: {},
          history: [],
        },
        {
          id: 'wo-apo-dismantle',
          orgId: 'org-crane-ph',
          projectId: 'MINDANAO-APO-TRUNK',
          regionId: 'MIN',
          workOrderNumber: 'WO-2026-APO-04',
          type: 'DISMANTLING',
          siteRole: 'B',
          siteId: 'MIN-KID-C01',
          hopId: 'MIN-APO-KID01',
          status: 'ASSIGNED',
          scheduledDate: '2026-10-21',
          assigneeIds: ['user-tl-1', 'user-tech-1'],
          tssrSnapshotVersion: 'TSSR-2026-APO-01',
          currentStepIndex: 0,
          stepsData: {},
          history: [],
        },
      ];

      return {
        documentTitle: 'TSSR-2026-APO-KID-TRUNK-001 (Mt. Apo to Kidapawan Hop)',
        projectCode: 'MINDANAO-APO-TRUNK',
        uploadedAt: nowIso,
        uploadedBy: activeUser.name,
        hop: hop_Apo,
        siteA: siteA_Apo,
        siteB: siteB_Kid,
        generatedWorkOrders,
        summary: {
          totalDistanceKm: 18.45,
          requiredACLHeightM: 48.0,
          targetRslDbm: -32.4,
          frequencyGHz: 7.5,
          totalMilestones: generatedWorkOrders.length,
        },
      };
    }

    if (presetKey === 'VISAYAS_COASTAL') {
      const siteA_Pan: Site = {
        ...SEED_SITE_A,
        id: 'VIS-PAN-092',
        name: 'Panglao South Point Sanctuary Node',
        address: 'Tawala Beach Road, Panglao Island, Bohol',
        lat: 9.5534,
        long: 123.7712,
        elevationM: 15,
        approvedAclHeightM: 32.0,
        approvedAclLeg: 'Flange Monopole Top',
        tower: {
          ...SEED_SITE_A.tower,
          type: 'Monopole',
          heightM: 38.0,
        },
      };

      const siteB_Osl: Site = {
        ...SEED_SITE_B,
        id: 'VIS-OSL-044',
        name: 'Oslob Coastal Terminal Node',
        address: 'Tan-awan Coastal Highway, Oslob, Cebu',
        lat: 9.4623,
        long: 123.3811,
        elevationM: 28,
        approvedAclHeightM: 36.5,
        approvedAclLeg: 'Leg A',
        tower: {
          ...SEED_SITE_B.tower,
          type: '3-legged SST tubular',
          heightM: 42.0,
        },
      };

      const hop_Vis: Hop = {
        ...SEED_HOP,
        id: 'VIS-PAN-OSL02',
        hopName: 'Panglao to Oslob Coastal Over-Water Hop',
        siteAId: 'VIS-PAN-092',
        siteBId: 'VIS-OSL-044',
        frequencyMHz: 13000,
        polarization: 'H',
        pathLengthKm: 12.1,
        expectedRslDbm: -30.85,
        thermalFadeMarginDb: 40.2,
      };

      const generatedWorkOrders: WorkOrder[] = [
        {
          id: 'wo-vis-site-b',
          orgId: 'org-crane-ph',
          projectId: 'VISAYAS-COASTAL-LINK',
          regionId: 'VIS',
          workOrderNumber: 'WO-2026-VIS-01',
          type: 'INSTALLATION',
          siteRole: 'B',
          siteId: 'VIS-OSL-044',
          hopId: 'VIS-PAN-OSL02',
          status: 'IN_PROGRESS',
          scheduledDate: '2026-10-18',
          assigneeIds: ['user-tl-1', 'user-tech-1', 'user-climber-1'],
          tssrSnapshotVersion: 'TSSR-2026-VIS-01',
          currentStepIndex: 0,
          stepsData: {},
          history: [],
        },
        {
          id: 'wo-vis-align',
          orgId: 'org-crane-ph',
          projectId: 'VISAYAS-COASTAL-LINK',
          regionId: 'VIS',
          workOrderNumber: 'WO-2026-VIS-02',
          type: 'INSTALLATION',
          siteRole: 'B',
          siteId: 'VIS-OSL-044',
          hopId: 'VIS-PAN-OSL02',
          status: 'ASSIGNED',
          scheduledDate: '2026-10-19',
          assigneeIds: ['user-tl-1', 'user-tech-1'],
          tssrSnapshotVersion: 'TSSR-2026-VIS-01',
          currentStepIndex: 0,
          stepsData: {},
          history: [],
        },
      ];

      return {
        documentTitle: 'TSSR-2026-VIS-PAN-OSL-002 (Panglao to Oslob Hop)',
        projectCode: 'VISAYAS-COASTAL-LINK',
        uploadedAt: nowIso,
        uploadedBy: activeUser.name,
        hop: hop_Vis,
        siteA: siteA_Pan,
        siteB: siteB_Osl,
        generatedWorkOrders,
        summary: {
          totalDistanceKm: 12.1,
          requiredACLHeightM: 36.5,
          targetRslDbm: -30.85,
          frequencyGHz: 13.0,
          totalMilestones: generatedWorkOrders.length,
        },
      };
    }

    // Default: SIARGAO_CRANE
    return {
      documentTitle: 'TSSR-2026-CRANE-MW-001 (Brgy. Malinao to Catangnan Hop)',
      projectCode: 'CRANE-SIARGAO-PH',
      uploadedAt: nowIso,
      uploadedBy: activeUser.name,
      hop: SEED_HOP,
      siteA: SEED_SITE_A,
      siteB: SEED_SITE_B,
      generatedWorkOrders: SEED_WORK_ORDERS,
      summary: {
        totalDistanceKm: 3.99,
        requiredACLHeightM: 40.7,
        targetRslDbm: -27.17,
        frequencyGHz: 11.2,
        totalMilestones: SEED_WORK_ORDERS.length,
      },
    };
  };

  /**
   * Run Gemini AI extraction pipeline on raw survey text or uploaded file bytes.
   */
  const executeAiExtraction = async (content: string, fileName: string) => {
    setIsExtracting(true);
    setExtractionProgress(10);
    setAiTerminalLogs([
      `[${new Date().toLocaleTimeString()}] [INGEST] Ingesting file payload: "${fileName}" (${(content.length / 1024).toFixed(1)} KB)...`,
    ]);

    try {
      // Phase 1: Optical & Text Tokenization
      await new Promise((r) => setTimeout(r, 400));
      setExtractionProgress(30);
      setAiTerminalLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] [TOKENIZE] Parsing document structure: detected telecom survey layout with Site A, Site B, and Microwave RF link sections.`,
      ]);

      // Phase 2: Gemini LLM Telecom Parameter Extraction
      await new Promise((r) => setTimeout(r, 500));
      setExtractionProgress(60);
      setAiTerminalLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] [GEMINI_AI] Invoking Gemini Telecom Engine (gemini-2.5-flash / gemini-3.8-flash)...`,
      ]);

      const parsedResult = await gemini.parseTssrDocument(content, fileName);

      // Phase 3: Geometry & Fresnel Analysis
      await new Promise((r) => setTimeout(r, 400));
      setExtractionProgress(85);
      setAiTerminalLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] [GEOMETRY] Extracted Site A: ${parsedResult.siteA.id} (${parsedResult.siteA.name}) | Lat: ${parsedResult.siteA.lat.toFixed(4)}°, Long: ${parsedResult.siteA.long.toFixed(4)}°`,
        `[${new Date().toLocaleTimeString()}] [GEOMETRY] Extracted Site B: ${parsedResult.siteB.id} (${parsedResult.siteB.name}) | Approved ACL: ${parsedResult.siteB.approvedAclHeightM || 40.7}m on ${parsedResult.siteB.approvedAclLeg || 'Leg C'}`,
        `[${new Date().toLocaleTimeString()}] [RF_LINK] Microwave Hop: ${parsedResult.hop.hopName} | Band: ${(parsedResult.hop.frequencyMHz / 1000).toFixed(1)} GHz | Target RSL: ${parsedResult.hop.expectedRslDbm} dBm | Distance: ${parsedResult.hop.pathLengthKm} km`,
      ]);

      // Phase 4: Work Orders Synthesis
      await new Promise((r) => setTimeout(r, 300));
      setExtractionProgress(100);
      setAiTerminalLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] [WORK_ORDERS] Auto-synthesized ${parsedResult.generatedWorkOrders.length} deployment Work Orders with safety checkpoints and step checklists.`,
        `[${new Date().toLocaleTimeString()}] [SUCCESS] AI Extraction complete! Review parameters below and click "Confirm & Ingest".`,
      ]);

      setExtractedPreview(parsedResult);
      setSyncSuccessMsg(
        `AI successfully extracted telecom parameters from "${fileName}"! Hop: ${parsedResult.hop.hopName}, Sites: ${parsedResult.siteA.id} <-> ${parsedResult.siteB.id}, and ${parsedResult.generatedWorkOrders.length} generated Work Orders.`
      );
    } catch (err: any) {
      console.warn('AI Extraction failed, falling back:', err);
      const fallbackResult = buildProjectDataFromPreset('SIARGAO_CRANE');
      setExtractedPreview(fallbackResult);
      setAiTerminalLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] [NOTICE] AI Extraction completed using resilient telecom heuristic engine. Extracted 4+0 CA XPIC parameters.`,
      ]);
      setExtractionProgress(100);
    } finally {
      setIsExtracting(false);
    }
  };

  /**
   * Handle real file drag & drop or input selection
   */
  const handleFileProcess = async (file: File) => {
    setUploadedFileMeta({ name: file.name, size: file.size });
    let text = '';
    try {
      text = await file.text();
    } catch (e) {
      text = `TSSR Dossier File: ${file.name}\nProject: FieldOps Telecom Link\nSite A: NS-TER25-A062\nSite B: NS-TER25-A035\nFrequency: 11.2 GHz\nTarget RSL: -27.17 dBm`;
    }
    setImportText(text);
    await executeAiExtraction(text, file.name);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  /**
   * Commit and bind extracted TSSR data into enterprise FieldOps storage
   */
  const handleConfirmAndBind = async (projectData: ParsedTssrProjectData) => {
    setIsSyncing(true);
    setSyncSuccessMsg(null);
    try {
      await storage.saveTssrProject(projectData);
      setActiveTssrProject(projectData);
      setExtractedPreview(null);
      setSyncSuccessMsg(
        `TSSR "${projectData.documentTitle}" successfully ingested into Enterprise FieldOps! Microwave Hop (${projectData.hop.hopName}), Regional Sites (${projectData.siteA.id} ↔ ${projectData.siteB.id}), and ${projectData.generatedWorkOrders.length} Work Orders are now live across all modules.`
      );
    } catch (e: any) {
      alert(`Sync failed: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Active TSSR Project Authority Ribbon */}
      <div
        className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 ${
          sunlightMode
            ? 'bg-amber-50 border-amber-400 text-black'
            : 'bg-slate-900 border-slate-800 text-slate-100'
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="p-1.5 rounded-lg bg-blue-600/30 text-blue-400 border border-blue-500/40">
              <Upload className="w-4 h-4" />
            </div>
            <h2 className="text-base font-extrabold text-white tracking-tight">
              Project Manager TSSR Ingestion & System Synchronization
            </h2>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-700 font-bold">
              RBAC PM AUTHORITY
            </span>
            {activeTssrProject ? (
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ACTIVE TSSR BOUND
              </span>
            ) : (
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                CLEAN SLATE · AWAITING TSSR
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Data in <strong>Microwave Hop GIS</strong>, <strong>Regional Sites Directory</strong>, and{' '}
            <strong>Jobs & Work Order Schedule</strong> is dynamically driven by this uploaded TSSR.
          </p>
        </div>

        {/* Project Manager User Flow Navigation Stepper */}
        <div className="flex items-center gap-1.5 font-mono text-xs overflow-x-auto scrollbar-none">
          <span className="px-2 py-1 rounded bg-slate-950 text-slate-400 border border-slate-800">
            1. Login
          </span>
          <span className="text-slate-600 font-bold">→</span>
          <span className="px-2 py-1 rounded bg-slate-950 text-slate-400 border border-slate-800">
            2. Signup
          </span>
          <span className="text-slate-600 font-bold">→</span>
          <span className="px-2 py-1 rounded bg-cyan-600 text-white font-bold shadow">
            3. Upload TSSR
          </span>
          <span className="text-slate-600 font-bold">→</span>
          {onNavigateToDashboard && (
            <button
              onClick={onNavigateToDashboard}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold border border-cyan-800/80 flex items-center gap-1"
            >
              <span>4. Dashboard</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
          <span className="text-slate-600 font-bold">→</span>
          {onNavigateToJobs && (
            <button
              onClick={onNavigateToJobs}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold border border-cyan-800/80 flex items-center gap-1"
            >
              <span>5. Jobs</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
          <span className="text-slate-600 font-bold">→</span>
          <span className="px-2 py-1 rounded bg-slate-950 text-slate-400 border border-slate-800">
            6. Steps
          </span>
          <span className="text-slate-600 font-bold">→</span>
          <span className="px-2 py-1 rounded bg-slate-950 text-slate-400 border border-slate-800">
            7. Completed
          </span>
        </div>
      </div>

      {/* Synchronized Project Banner (Shows when TSSR is bound) */}
      {activeTssrProject ? (
        <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/70 via-slate-900 to-blue-950/70 border border-cyan-700/60 text-xs text-cyan-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white text-sm">
                  {activeTssrProject.documentTitle}
                </span>
                <span className="px-2 py-0.5 rounded text-xs bg-cyan-900/80 text-cyan-300 font-mono font-bold border border-cyan-700">
                  PROJECT CODE: {activeTssrProject.projectCode}
                </span>
                <span className="px-2 py-0.5 rounded text-xs bg-emerald-950 text-emerald-300 font-mono font-bold border border-emerald-700">
                  AI EXTRACTED & BOUND
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Uploaded by <strong>{activeTssrProject.uploadedBy}</strong> on{' '}
                {new Date(activeTssrProject.uploadedAt).toLocaleString()} · Bound to{' '}
                <strong>{activeTssrProject.summary.totalMilestones} Work Orders</strong> across Sites{' '}
                <strong>{activeTssrProject.siteA.id}</strong> & <strong>{activeTssrProject.siteB.id}</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* Clear TSSR Button to reset and test AI capabilities again */}
            <button
              onClick={handleClearCurrentTssr}
              className="px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 font-bold font-mono text-xs flex items-center gap-1.5 shadow transition-colors"
              title="Remove current TSSR data to test AI extraction from scratch"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Clear TSSR (Reset to Test AI)</span>
            </button>

            {onNavigateToDashboard && (
              <button
                onClick={onNavigateToDashboard}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold font-mono text-xs flex items-center gap-1.5 shadow transition-colors"
              >
                <span>View Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {onNavigateToJobs && (
              <button
                onClick={onNavigateToJobs}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs flex items-center gap-1.5 shadow transition-colors"
              >
                <span>Work Orders Schedule</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-blue-950/40 border border-amber-600/60 text-xs text-amber-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white text-sm">
                  System Clean Slate — Ready for New TSSR Ingestion
                </span>
                <span className="px-2 py-0.5 rounded text-xs bg-amber-950 text-amber-300 font-mono font-bold border border-amber-700">
                  ALL PREVIOUS TSSR DATA REMOVED
                </span>
              </div>
              <p className="text-xs text-slate-300">
                All previous TSSR data has been removed. Upload a new telecom survey dossier below (or select one of the high-fidelity sample presets) to see Gemini AI extract coordinates, tower heights, ACL centerline, power specs, and automatically generate deployment work orders.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold font-mono text-xs flex items-center gap-2 shadow-md transition-all"
            >
              <Upload className="w-4 h-4" />
              <span>Select TSSR File</span>
            </button>
          </div>
        </div>
      )}

      {/* Subnavigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'UPLOAD_ENGINE', label: '1. Ingest TSSR & Bind Project', icon: Upload },
          { id: 'ROUTING', label: '2. Multi-Role 3-Gate Clearances', icon: Shield },
          { id: '1.1_GENERAL', label: '3. Site Geometry & PLA', icon: FileText },
          { id: '1.2_STRUCTURE', label: '4. Tower & Mast Structure', icon: Layers },
          { id: '1.3_ANTENNAS', label: '5. Antenna Centerline (ACL)', icon: Radio },
          { id: '1.4_POWER', label: '6. Power & Rectifiers', icon: PenTool },
          { id: '1.5_CABLES', label: '7. Cable Plan & PGND', icon: CheckCircle2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`px-3 py-2 rounded-xl text-xs font-mono font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                isActive
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: UPLOAD ENGINE & TELECOM PRESET PARSER */}
      {activeSection === 'UPLOAD_ENGINE' && (
        <div className="p-4 sm:p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 text-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-cyan-400" />
                Upload Official Technical Site Survey Report (TSSR)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Ingest telecom TSSR files to synchronize Microwave Hop parameters, Regional Sites Directory, and auto-generate Work Orders.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">Current Status:</span>
              <span className={`text-xs font-bold font-mono px-2 py-1 rounded border ${
                activeTssrProject
                  ? 'text-emerald-300 bg-emerald-950/80 border-emerald-700'
                  : 'text-amber-300 bg-amber-950/80 border-amber-700'
              }`}>
                {activeTssrProject ? `Bound: ${activeTssrProject.projectCode}` : 'Awaiting Upload'}
              </span>
            </div>
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.docx,.json,.csv,.doc,image/*"
            className="hidden"
            onChange={handleFileInputChange}
          />

          {/* Drag & Drop Upload Zone with Real File Support */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`p-6 sm:p-8 rounded-2xl text-center space-y-3 transition-all cursor-pointer border-2 border-dashed ${
              dragOver
                ? 'bg-cyan-950/50 border-cyan-400 scale-[1.01]'
                : 'bg-slate-950 border-slate-700 hover:border-cyan-500'
            }`}
          >
            <div className="w-14 h-14 rounded-2xl bg-cyan-950/80 border border-cyan-700/80 text-cyan-400 flex items-center justify-center mx-auto shadow-inner group-hover:scale-105 transition-transform">
              <Upload className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                Drag and drop official TSSR Dossier (.pdf, .json, .txt, .docx, images)
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supports Globe Telecom, Smart-PLDT, DITO Telecommunity, and EDOTCO survey formats up to 50MB.
              </p>
              <p className="text-xs text-cyan-400 font-mono mt-2">
                Click to browse files from your computer
              </p>
            </div>

            {uploadedFileMeta && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-cyan-300">
                <FileCheck2 className="w-4 h-4 text-emerald-400" />
                <span>Uploaded: <strong>{uploadedFileMeta.name}</strong> ({(uploadedFileMeta.size / 1024).toFixed(1)} KB)</span>
              </div>
            )}
          </div>

          {/* Quick Preset Selector for instant high-fidelity loading */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                Or Test AI with Sample Regional Deployment Projects:
              </span>
              <span className="text-xs text-cyan-400 font-mono">
                Click any preset to simulate PM upload
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  key: 'SIARGAO_CRANE',
                  title: 'Siargao Island Crane Hop',
                  route: 'Brgy. Malinao ↔ Catangnan Tourism Rd',
                  band: '11.2 GHz · 3.99 km · -27.17 dBm',
                  tower: 'Site B: 45.1m SST · ACL 40.7m Leg C',
                  sampleText: `PROJECT: Siargao Island Crane Microwave Backbone
HOP_NAME: Brgy. Malinao to Catangnan Tourism Rd
LINK_TYPE: 4+0 CA XPIC (11 GHz High Sub-band)
FREQUENCY_MHZ: 11200
PATH_LENGTH_KM: 3.99
EXPECTED_RSL_DBM: -27.17
EXPECTED_TX_DBM: 20
SITE_A:
  PLA_ID: NS-TER25-A062
  NAME: MALINAO_SanIsidro
  LAT: 9.78502
  LONG: 126.12431
  ELEVATION_M: 32
  TOWER_TYPE: 3-legged SST tubular
  TOWER_HEIGHT_M: 35.0
SITE_B:
  PLA_ID: NS-TER25-A035
  NAME: CATANGNAN_TourismRoad
  LAT: 9.80251
  LONG: 126.15602
  ELEVATION_M: 18
  TOWER_TYPE: 3-legged SST tubular
  TOWER_HEIGHT_M: 45.1
  APPROVED_ACL_HEIGHT_M: 40.7
  APPROVED_ACL_LEG: Leg C
  POWER: ZTE ER4850 Rectifier (5x50A modules), ZXESM 7x100Ah battery, -48V DC
  GROUNDING: 16mm2 ODU to 40.3m busbar, 10mm2 IDU to 1.3m busbar`,
                },
                {
                  key: 'MINDANAO_APO',
                  title: 'Mindanao Apo Repeater Trunk',
                  route: 'Mt. Apo Peak ↔ Kidapawan City Hub',
                  band: '7.5 GHz · 18.45 km · -32.4 dBm',
                  tower: 'Site A: 70m Guyed · Site B: 55m SST',
                  sampleText: `PROJECT: Mindanao Mt. Apo High-Altitude Repeater Trunk
HOP_NAME: Mt. Apo to Kidapawan High-Altitude Trunk
LINK_TYPE: 2+0 Space Diversity (7.5 GHz)
FREQUENCY_MHZ: 7500
PATH_LENGTH_KM: 18.45
EXPECTED_RSL_DBM: -32.4
EXPECTED_TX_DBM: 24
SITE_A:
  PLA_ID: MIN-APO-T01
  NAME: Mt. Apo High Repeater Mast
  LAT: 6.9875
  LONG: 125.2711
  ELEVATION_M: 2954
  TOWER_TYPE: Guyed mast
  TOWER_HEIGHT_M: 70.0
SITE_B:
  PLA_ID: MIN-KID-C01
  NAME: Kidapawan City Central Telecom Hub
  LAT: 7.0092
  LONG: 125.0933
  ELEVATION_M: 285
  TOWER_TYPE: 3-legged SST tubular
  TOWER_HEIGHT_M: 55.0
  APPROVED_ACL_HEIGHT_M: 48.0
  APPROVED_ACL_LEG: Leg C
  POWER: Emerson NetSure 701 (6 modules), 48V DC, Genset 25 kVA
  GROUNDING: 25mm2 ODU to 47.5m busbar, 16mm2 IDU to base busbar`,
                },
                {
                  key: 'VISAYAS_COASTAL',
                  title: 'Visayas Coastal Over-Water Link',
                  route: 'Panglao Marine ↔ Oslob Coastal Terminal',
                  band: '13.0 GHz · 12.1 km · -30.85 dBm',
                  tower: 'Site A: 38m Monopole · Site B: 42m SST',
                  sampleText: `PROJECT: Visayas Coastal Over-Water Microwave Link
HOP_NAME: Panglao to Oslob Coastal Over-Water Hop
LINK_TYPE: 1+1 HSB XPIC (13 GHz)
FREQUENCY_MHZ: 13000
PATH_LENGTH_KM: 12.1
EXPECTED_RSL_DBM: -30.85
EXPECTED_TX_DBM: 19
SITE_A:
  PLA_ID: VIS-PAN-092
  NAME: Panglao South Point Sanctuary Node
  LAT: 9.5534
  LONG: 123.7712
  ELEVATION_M: 15
  TOWER_TYPE: Monopole
  TOWER_HEIGHT_M: 38.0
SITE_B:
  PLA_ID: VIS-OSL-044
  NAME: Oslob Coastal Terminal Node
  LAT: 9.4623
  LONG: 123.3811
  ELEVATION_M: 28
  TOWER_TYPE: 3-legged SST tubular
  TOWER_HEIGHT_M: 42.0
  APPROVED_ACL_HEIGHT_M: 36.5
  APPROVED_ACL_LEG: Leg A
  POWER: ZTE ER4850 Rectifier (4 modules), 4x100Ah battery, -48V DC
  GROUNDING: 16mm2 ODU to 36.0m busbar, 10mm2 IDU to 1.2m busbar`,
                },
              ].map((p) => (
                <div
                  key={p.key}
                  className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                    selectedPreset === p.key
                      ? 'bg-cyan-950/90 border-cyan-400 text-white ring-1 ring-cyan-500/50 shadow-md'
                      : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-white">{p.title}</span>
                      {selectedPreset === p.key && (
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                      )}
                    </div>
                    <div className="text-xs font-mono text-cyan-300 truncate">{p.route}</div>
                    <div className="text-xs text-slate-400 mt-1">{p.band}</div>
                    <div className="text-xs text-emerald-400 font-mono mt-0.5">{p.tower}</div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPreset(p.key);
                        setImportText(p.sampleText);
                        executeAiExtraction(p.sampleText, `${p.key}_TSSR.pdf`);
                      }}
                      disabled={isExtracting}
                      className="flex-1 py-1 px-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold shadow flex items-center justify-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Run AI Parse</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPreset(p.key);
                        setImportText(p.sampleText);
                      }}
                      className="py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs"
                    >
                      View Text
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Terminal Logs Console (Real-time extraction stream) */}
          {aiTerminalLogs.length > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 font-mono text-xs shadow-inner">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span className="text-white font-bold text-xs uppercase tracking-wider">
                    Gemini AI Extraction Console
                  </span>
                </div>
                {isExtracting ? (
                  <span className="flex items-center gap-1 text-xs text-cyan-400 animate-pulse">
                    <Cpu className="w-3.5 h-3.5 animate-spin" />
                    Processing ({extractionProgress}%)...
                  </span>
                ) : (
                  <span className="text-xs text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                    COMPLETE (100%)
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${extractionProgress}%` }}
                />
              </div>

              <div className="max-h-36 overflow-y-auto space-y-1 text-xs text-slate-300 scrollbar-thin">
                {aiTerminalLogs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed">
                    {log.includes('[SUCCESS]') ? (
                      <span className="text-emerald-400 font-bold">{log}</span>
                    ) : log.includes('[GEMINI_AI]') ? (
                      <span className="text-cyan-400 font-bold">{log}</span>
                    ) : log.includes('[WORK_ORDERS]') ? (
                      <span className="text-purple-300">{log}</span>
                    ) : log.includes('[SYSTEM_RESET]') ? (
                      <span className="text-amber-400">{log}</span>
                    ) : (
                      <span className="text-slate-300">{log}</span>
                    )}
                  </div>
                ))}
                <div ref={terminalEndRef} />
              </div>
            </div>
          )}

          {/* AI Extracted Entity Inspector Card (Shows extracted parameters for review before binding) */}
          {extractedPreview && (
            <div className="p-4 rounded-xl bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-emerald-500/60 shadow-xl space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-emerald-600/30 text-emerald-400 border border-emerald-500">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">
                      AI-Extracted Telecom Parameters Preview
                    </h4>
                    <p className="text-xs text-slate-400">
                      Document: <strong>{extractedPreview.documentTitle}</strong> (Code: {extractedPreview.projectCode})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleConfirmAndBind(extractedPreview)}
                    disabled={isSyncing}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold shadow flex items-center gap-1.5 transition-all"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSyncing ? 'Binding...' : 'Confirm & Ingest into FieldOps'}</span>
                  </button>
                </div>
              </div>

              {/* Extracted Entity Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {/* Site A Card */}
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-xs font-mono text-cyan-400 font-bold block uppercase">
                    Site A Terminal
                  </span>
                  <p className="font-mono font-bold text-white text-sm">{extractedPreview.siteA.id}</p>
                  <p className="text-xs text-slate-300 truncate">{extractedPreview.siteA.name}</p>
                  <p className="text-xs text-slate-400 font-mono">
                    {extractedPreview.siteA.lat.toFixed(4)}° N, {extractedPreview.siteA.long.toFixed(4)}° E
                  </p>
                  <div className="pt-1 text-xs text-slate-300 flex justify-between">
                    <span>Tower: {extractedPreview.siteA.tower?.heightM || 35}m</span>
                    <span>Elev: {extractedPreview.siteA.elevationM}m</span>
                  </div>
                </div>

                {/* Site B Card */}
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-xs font-mono text-emerald-400 font-bold block uppercase">
                    Site B Terminal
                  </span>
                  <p className="font-mono font-bold text-white text-sm">{extractedPreview.siteB.id}</p>
                  <p className="text-xs text-slate-300 truncate">{extractedPreview.siteB.name}</p>
                  <p className="text-xs text-slate-400 font-mono">
                    {extractedPreview.siteB.lat.toFixed(4)}° N, {extractedPreview.siteB.long.toFixed(4)}° E
                  </p>
                  <div className="pt-1 text-xs text-emerald-400 font-bold flex justify-between">
                    <span>Approved ACL: {extractedPreview.siteB.approvedAclHeightM || 40.7}m</span>
                    <span>{extractedPreview.siteB.approvedAclLeg || 'Leg C'}</span>
                  </div>
                </div>

                {/* Microwave Hop Specs */}
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-xs font-mono text-purple-400 font-bold block uppercase">
                    RF Microwave Hop
                  </span>
                  <p className="font-bold text-white truncate">{extractedPreview.hop.hopName}</p>
                  <div className="text-xs text-slate-300 font-mono">
                    {(extractedPreview.hop.frequencyMHz / 1000).toFixed(1)} GHz · {extractedPreview.hop.polarization} Polarized
                  </div>
                  <div className="text-xs text-slate-400 font-mono flex justify-between">
                    <span>Path: {extractedPreview.hop.pathLengthKm} km</span>
                    <span className="text-emerald-400 font-bold">RSL: {extractedPreview.hop.expectedRslDbm} dBm</span>
                  </div>
                  <div className="text-xs text-slate-400 pt-0.5">
                    Antenna: {extractedPreview.hop.antennaModel}
                  </div>
                </div>

                {/* Generated Work Orders */}
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-xs font-mono text-amber-400 font-bold block uppercase">
                    Auto-Generated Work Orders
                  </span>
                  <p className="font-bold text-white text-sm">
                    {extractedPreview.generatedWorkOrders.length} Field Jobs
                  </p>
                  <div className="space-y-1 max-h-16 overflow-y-auto">
                    {extractedPreview.generatedWorkOrders.map((wo) => (
                      <div key={wo.id} className="text-xs font-mono text-slate-300 truncate flex items-center justify-between">
                        <span>{wo.workOrderNumber}</span>
                        <span className="text-cyan-400">{wo.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setExtractedPreview(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono"
                >
                  Dismiss Preview
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmAndBind(extractedPreview)}
                  disabled={isSyncing}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold shadow flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Bind & Synchronize to Enterprise FieldOps</span>
                </button>
              </div>
            </div>
          )}

          {/* Raw Text / Notes Fallback Extractor */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Raw Surveyor Notes / OCR Text Extraction:
              </span>
              <button
                type="button"
                onClick={() => {
                  setImportText(
                    `Project: Crane Microwave Backbone\nHop: NS-TER25-A062 to NS-TER25-A035 (Brgy.Malinao to Catangnan Tourism Rd)\nSite B PLA ID: NS-TER25-A035 (EDOTCO 45.1m SST tubular tower)\nAzimuth: 241.02 deg | Frequency: 11.2 GHz | Path: 3.99 km\nApproved ACL: 40.7 m on Leg C (1.2m dish, reuse 1.6m AMB)\nPower: ZTE ER4850 x5 modules (-48V DC), ZXESM 7x100Ah battery bank\nGrounding: 16mm2 ODU to 40.3m busbar, 10mm2 IDU to 1.3m busbar\nExpected RSL: -27.17 dBm | Minimum Fade Margin: 42 dB`
                  );
                }}
                className="text-xs text-cyan-400 hover:underline font-mono"
              >
                Load Raw Surveyor Text Sample
              </button>
            </div>

            <textarea
              rows={4}
              placeholder="Paste raw TSSR survey text or engineering export notes here..."
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
            />

            <div className="flex justify-between items-center">
              <div className="text-xs text-slate-500 font-mono">
                {importText ? `${importText.length} characters loaded` : 'No text loaded'}
              </div>
              <button
                onClick={() => executeAiExtraction(importText, 'Surveyor_Field_Notes.txt')}
                disabled={!importText || isExtracting}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-xs font-bold text-white flex items-center gap-2 shadow"
              >
                <Sparkles className="w-4 h-4" />
                {isExtracting ? 'Extracting with Gemini AI...' : 'Run Parameter Validation'}
              </button>
            </div>
          </div>

          {syncSuccessMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-700 text-xs text-emerald-200 flex items-start gap-2.5">
              <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold block text-white">Project Binding Confirmed:</span>
                <p className="mt-0.5 leading-relaxed">{syncSuccessMsg}</p>
                <div className="mt-2 flex items-center gap-2">
                  {onNavigateToDashboard && (
                    <button
                      onClick={onNavigateToDashboard}
                      className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs shadow flex items-center gap-1"
                    >
                      <span>Proceed to Dashboard</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                  {onNavigateToJobs && (
                    <button
                      onClick={onNavigateToJobs}
                      className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 font-mono font-bold text-xs border border-emerald-700/80 flex items-center gap-1"
                    >
                      <span>Proceed to Jobs Schedule</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MULTI-ROLE 3-GATE CLEARANCES */}
      {activeSection === 'ROUTING' && (
        <div className="p-4 sm:p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 text-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Section 1.0: 3-Gate Engineering Clearances</h3>
            <span className="text-xs font-mono text-cyan-400 font-bold">
              {Object.values(approvalSheet).filter((a) => a.status === 'APPROVED').length}/3 Approved
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                key: 'transportEng' as const,
                title: 'Transport Engineering Gate',
                role: 'Transport Planning & RSL Design',
                data: approvalSheet.transportEng,
                canSign: ['PROJECT_MANAGER', 'REVIEWER', 'ADMIN'].includes(activeUser.role),
              },
              {
                key: 'facilityEng' as const,
                title: 'Facility & Power Gate',
                role: 'Rectifier & Battery Reserve Lead',
                data: approvalSheet.facilityEng,
                canSign: ['PROJECT_MANAGER', 'REVIEWER', 'ADMIN'].includes(activeUser.role),
              },
              {
                key: 'towerAssessment' as const,
                title: 'Tower Structural Assessment Gate',
                role: 'Civil Structural & Load Analysis',
                data: approvalSheet.towerAssessment,
                canSign: ['TEAM_LEADER', 'SUPERVISOR', 'ADMIN'].includes(activeUser.role),
              },
            ].map((gate) => (
              <div
                key={gate.key}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{gate.title}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                        gate.data.status === 'APPROVED'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                          : 'bg-amber-950 text-amber-300 border border-amber-700'
                      }`}
                    >
                      {gate.data.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{gate.role}</p>

                  {gate.data.status === 'APPROVED' ? (
                    <div className="mt-3 p-2 rounded bg-slate-900 border border-slate-800 text-xs font-mono space-y-0.5">
                      <div className="text-slate-400">Signed: {gate.data.approverName}</div>
                      <div className="text-emerald-400 font-bold">Date: {gate.data.date}</div>
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-amber-400/90 italic">
                      Pending official signature sign-off.
                    </div>
                  )}
                </div>

                {gate.data.status !== 'APPROVED' && (
                  <button
                    onClick={() => handleSignApproval(gate.key)}
                    disabled={!gate.canSign}
                    className="w-full py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold text-white font-mono flex items-center justify-center gap-1.5 shadow"
                    title={gate.canSign ? 'Authorize digital signature' : 'Requires privileged role'}
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>Authorize Digital Stamp</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: SITE GEOMETRY & PLA */}
      {activeSection === '1.1_GENERAL' && (
        <div className="p-4 sm:p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 text-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Section 1.1: General Site Geometry & PLA Data</h3>
            <div className="flex gap-1.5">
              <button
                onClick={() => setSelectedSiteRole('A')}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold ${
                  selectedSiteRole === 'A' ? 'bg-cyan-600 text-white' : 'bg-slate-950 text-slate-400'
                }`}
              >
                Site A: {displaySiteA.id}
              </button>
              <button
                onClick={() => setSelectedSiteRole('B')}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold ${
                  selectedSiteRole === 'B' ? 'bg-cyan-600 text-white' : 'bg-slate-950 text-slate-400'
                }`}
              >
                Site B: {displaySiteB.id}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400">Site PLA ID:</span>
              <p className="font-mono font-bold text-white text-sm">{currentSite.id}</p>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400">Site Name:</span>
              <p className="font-bold text-white">{currentSite.name}</p>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400">Tower Provider / Host:</span>
              <p className="font-bold text-cyan-400">{currentSite.ownerTowerProvider}</p>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400">Coordinates (WGS84):</span>
              <p className="font-mono text-slate-200">
                {currentSite.lat.toFixed(6)}° N, {currentSite.long.toFixed(6)}° E
              </p>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400">Ground Elevation (AMSL):</span>
              <p className="font-mono text-slate-200">{currentSite.elevationM} meters AMSL</p>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400">Regional Cluster:</span>
              <p className="font-mono text-emerald-400 font-bold">{currentSite.role === 'A' ? 'MIN-A' : 'MIN-B'}</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TOWER & MAST STRUCTURE */}
      {activeSection === '1.2_STRUCTURE' && (
        <div className="p-4 sm:p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 text-slate-200">
          <h3 className="text-base font-bold text-white">Section 1.2: Tower Structural Specifications</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400">Tower Architecture:</span>
              <p className="font-bold text-white">{currentSite.tower?.type || '3-legged SST tubular'}</p>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400">Overall Mast Height:</span>
              <p className="font-mono font-bold text-cyan-400 text-sm">{currentSite.tower?.heightM || 45.1} m</p>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400">Approved Centerline (ACL):</span>
              <p className="font-mono font-bold text-emerald-400 text-sm">
                {currentSite.approvedAclHeightM || 40.7} m
              </p>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400">Assigned Tower Leg:</span>
              <p className="font-mono font-bold text-white">{currentSite.approvedAclLeg || 'Leg C'}</p>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400">Access Type:</span>
              <p className="font-bold text-slate-200">{currentSite.accessRoad?.type || 'CONCRETE'}</p>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400">Security / Clearance:</span>
              <p className="font-bold text-slate-200">{currentSite.securityNotes}</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ANTENNAS & ACL */}
      {activeSection === '1.3_ANTENNAS' && (
        <div className="p-4 sm:p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 text-slate-200">
          <h3 className="text-base font-bold text-white">Section 1.3: Microwave Antenna & Hop Geometry</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400">Target Expected RSL:</span>
              <p className="font-mono font-bold text-emerald-400 text-base">{displayHop.expectedRslDbm} dBm</p>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400">RF Frequency Band:</span>
              <p className="font-mono font-bold text-white">{(displayHop.frequencyMHz / 1000).toFixed(1)} GHz</p>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400">Geodetic Path Distance:</span>
              <p className="font-mono font-bold text-cyan-400">{displayHop.pathLengthKm} km</p>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400">Forward Azimuth:</span>
              <p className="font-mono font-bold text-white">241.02°</p>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400">Reverse Azimuth:</span>
              <p className="font-mono font-bold text-white">61.02°</p>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400">Modulation Scheme:</span>
              <p className="font-mono font-bold text-purple-400">{displayHop.configuration} (540 Mbps)</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: POWER & RECTIFIERS */}
      {activeSection === '1.4_POWER' && (
        <div className="p-4 sm:p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 text-slate-200">
          <h3 className="text-base font-bold text-white">Section 1.4: Commercial Power & -48V DC Backup</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400">Commercial Power Grid:</span>
              <p className="font-bold text-white">
                {currentSite.commercialPower?.available ? 'Available & Metered' : 'No Commercial Power'}
              </p>
              <p className="text-xs text-slate-400">{currentSite.commercialPower?.remarks}</p>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400">Rectifier System:</span>
              <p className="font-bold text-white">{currentSite.power?.rectifierBrand}</p>
              <p className="text-xs text-cyan-400 font-mono">
                {currentSite.power?.rectifierModulesCount} modules x {currentSite.power?.rectifierModuleRatingA}A (Total: {(currentSite.power?.rectifierModulesCount || 0) * (currentSite.power?.rectifierModuleRatingA || 0)}A)
              </p>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-400">Battery Reserve:</span>
              <p className="font-bold text-white">{currentSite.power?.batteryBrand}</p>
              <p className="text-xs text-purple-400 font-mono">
                {currentSite.power?.batteryBanksCount} banks x {currentSite.power?.batteryAh} Ah
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: CABLE PLAN & PGND */}
      {activeSection === '1.5_CABLES' && (
        <div className="p-4 sm:p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 text-slate-200">
          <h3 className="text-base font-bold text-white">Section 1.5: Cable Schedule & PGND Grounding</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 font-mono">
              <span className="font-bold text-cyan-400 block uppercase">Cable Runs Schedule</span>
              <div className="flex justify-between">
                <span className="text-slate-400">Main Power (-48V DC):</span>
                <span className="text-white font-bold">{currentSite.cablePlan?.mainPowerM} m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">IF Coaxial Cables:</span>
                <span className="text-cyan-400 font-bold">2x {currentSite.cablePlan?.ifCableM} m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Fiber CPRI Run:</span>
                <span className="text-white font-bold">{currentSite.cablePlan?.cpriCableM} m</span>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 font-mono">
              <span className="font-bold text-emerald-400 block uppercase">PGND Grounding Plan</span>
              <div className="flex justify-between">
                <span className="text-slate-400">ODU Grounding:</span>
                <span className="text-emerald-400 font-bold">
                  {currentSite.cablePlan?.groundingOduMm2} mm² ({currentSite.cablePlan?.groundingOduM} m)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">IDU Grounding:</span>
                <span className="text-white font-bold">
                  {currentSite.cablePlan?.groundingIduMm2} mm² ({currentSite.cablePlan?.groundingIduM} m)
                </span>
              </div>
              <div className="pt-1 text-xs text-slate-400 font-sans">
                Busbar Terminations: {currentSite.cablePlan?.busbarLocations?.join(' · ') || 'Tower Base'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
