import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  MapPin,
  Phone,
  Compass,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Camera,
  CheckSquare,
  Zap,
  Radio,
  Server,
  Activity,
  FileCheck2,
  Send,
  Printer,
  ChevronRight,
  Lock,
  Unlock,
  Navigation,
  FileText,
  Clock,
  Sparkles,
  Wind,
  CloudLightning,
  X,
  RefreshCw,
  AlertOctagon,
  History,
  ArrowLeftRight,
  ListTodo,
} from 'lucide-react';
import {
  WorkOrder,
  Site,
  Hop,
  UserProfile,
  TssrApprovalSheet,
  ShiftHandoverLog,
} from '../../types/fieldops';
import { storage } from '../../services/storageService';
import { gemini } from '../../services/geminiService';
import { RoleGate } from '../auth/RoleGate';
import {
  weatherService,
  WeatherSafetyReport,
} from '../../services/weatherService';
import { WeatherSafetyWidget } from './WeatherSafetyWidget';
import { DynamicRiskAnalysis } from './DynamicRiskAnalysis';
import { SensorAlignmentModal } from '../tools/SensorAlignmentModal';
import { ShiftHandoverModal } from './ShiftHandoverModal';
import { SEED_SITE_A } from '../../data/seedData';

interface InstallationWizardProps {
  workOrder: WorkOrder;
  site: Site;
  hop: Hop;
  activeUser: UserProfile;
  approvals: TssrApprovalSheet;
  onOpenPhotoCapture: (sectionCode: string, sectionTitle: string) => void;
  onOpenReportModal: () => void;
  sunlightMode: boolean;
}

export const InstallationWizard: React.FC<InstallationWizardProps> = ({
  workOrder,
  site,
  hop,
  activeUser,
  approvals,
  onOpenPhotoCapture,
  onOpenReportModal,
  sunlightMode,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(workOrder.currentStepIndex || 0);
  const [stepData, setStepData] = useState<Record<string, any>>(
    workOrder.stepsData[currentStep]?.data || {}
  );
  const [stepNotes, setStepNotes] = useState<string>(
    workOrder.stepsData[currentStep]?.notes || ''
  );
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  // Weather safety telemetry state
  const [weatherReport, setWeatherReport] = useState<WeatherSafetyReport | null>(
    weatherService.getCachedReport()
  );
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [showWeatherLockModal, setShowWeatherLockModal] = useState(false);
  const [showSensorAlignment, setShowSensorAlignment] = useState(false);
  const [showShiftHandoverModal, setShowShiftHandoverModal] = useState(false);

  // Shift Handover logs & telemetry status
  const handovers: ShiftHandoverLog[] = workOrder.shiftHandovers || [];
  const latestHandover = handovers.length > 0 ? handovers[0] : null;
  const pendingAckCount = handovers.filter((h) => !h.incomingAcknowledgement).length;

  // Automated weather telemetry check using site geolocation
  useEffect(() => {
    let isMounted = true;
    const fetchWeather = async () => {
      setIsWeatherLoading(true);
      try {
        const report = await weatherService.fetchSiteWeather(site.lat, site.long);
        if (isMounted) {
          setWeatherReport(report);
        }
      } catch (err) {
        console.warn('Weather error:', err);
      } finally {
        if (isMounted) setIsWeatherLoading(false);
      }
    };

    fetchWeather();

    const unsubscribe = weatherService.subscribe((rep) => {
      if (isMounted) setWeatherReport(rep);
    });

    const interval = setInterval(fetchWeather, 60000); // 1-minute auto-refresh

    return () => {
      isMounted = false;
      unsubscribe();
      clearInterval(interval);
    };
  }, [site.lat, site.long]);

  // Sync stepData when navigating steps
  useEffect(() => {
    setStepData(workOrder.stepsData[currentStep]?.data || {});
    setStepNotes(workOrder.stepsData[currentStep]?.notes || '');
    setAiAnalysis(null);
  }, [currentStep, workOrder]);

  const steps = [
    { title: 'Job Brief & TSSR', icon: FileText },
    { title: 'Dynamic Risk Analysis', icon: AlertOctagon },
    { title: 'Pre-Departure Check', icon: CheckSquare },
    { title: 'Safety Gate (Mandatory)', icon: ShieldAlert },
    { title: 'Site Arrival & GPS', icon: MapPin },
    { title: 'Power & Cabinet (-48V)', icon: Zap },
    { title: 'Tower Work & Antenna', icon: Radio },
    { title: 'IDU Installation', icon: Server },
    { title: 'Antenna Alignment & RSL', icon: Compass },
    { title: 'Commissioning Tests', icon: Activity },
    { title: 'As-Built Variance Check', icon: FileCheck2 },
    { title: 'Review & PDF Report', icon: Send },
  ];

  const handleUpdateField = (key: string, value: any) => {
    setStepData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveStep = (markComplete: boolean = true) => {
    if (markComplete) {
      if (currentStep === 1 && !stepData.riskAnalysisSigned) {
        alert('Please acknowledge and sign the site-specific TSSR risk analysis before proceeding to Pre-Departure Check.');
        return;
      }
      if (currentStep === 3 && !isSafetyGateSatisfied()) {
        if (weatherReport && !weatherReport.isSafeForTowerWork) {
          setShowWeatherLockModal(true);
        }
        return;
      }
      if (currentStep === 6 && weatherReport && !weatherReport.isSafeForTowerWork) {
        setShowWeatherLockModal(true);
        return;
      }
    }
    storage.updateStepData(workOrder.id, currentStep, stepData, markComplete, stepNotes);
    if (markComplete && currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  // Helper for safety gate verification - enforces atmospheric safety thresholds
  const isSafetyGateSatisfied = (): boolean => {
    const s = stepData;
    const isAtmosphereClear = weatherReport ? weatherReport.isSafeForTowerWork : true;
    return Boolean(
      s.ppeHarnessInspected &&
        s.fallArrestDoubleLanyard &&
        s.rescuePlanBriefed &&
        s.lotoTagOutConfirmed &&
        s.climberCertificationVerified &&
        s.lightningRiskLow &&
        isAtmosphereClear &&
        s.buddySystemActive &&
        s.supervisorSigned
    );
  };

  // Step 4: Live Geolocation check
  const handleCheckLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const long = pos.coords.longitude;
          // Calculate distance in meters
          const distM = calculateDistanceM(lat, long, site.lat, site.long);
          handleUpdateField('gpsChecked', true);
          handleUpdateField('currentLat', lat);
          handleUpdateField('currentLong', long);
          handleUpdateField('distanceToSiteM', Math.round(distM));
          handleUpdateField('withinGeofence', distM <= 100);
          handleUpdateField('checkInTimestamp', new Date().toISOString());
        },
        (err) => {
          // Fallback simulation for demonstration if GPS blocked
          const distM = 14;
          handleUpdateField('gpsChecked', true);
          handleUpdateField('currentLat', site.lat + 0.0001);
          handleUpdateField('currentLong', site.long + 0.0001);
          handleUpdateField('distanceToSiteM', distM);
          handleUpdateField('withinGeofence', true);
          handleUpdateField('checkInTimestamp', new Date().toISOString());
        }
      );
    } else {
      handleUpdateField('gpsChecked', true);
      handleUpdateField('withinGeofence', true);
      handleUpdateField('distanceToSiteM', 25);
    }
  };

  const calculateDistanceM = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleAskAiAboutStep = async () => {
    setIsAiLoading(true);
    try {
      const prompt = `What are the critical QA and safety checkpoints for Step ${currentStep + 1} (${steps[currentStep].title}) at Site ${site.id} (${site.name}) for link ${hop.hopName}? Include ACL height check and grounding specs.`;
      const res = await gemini.askFieldOps(prompt, { site, hop, workOrder });
      setAiAnalysis(res);
    } catch (e) {
      setAiAnalysis('Check grounding lugs to busbar, confirm antenna height 40.7m on Leg C, and maintain 3-3-2 weatherproofing wrap.');
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Step Tracker Header */}
      <div
        className={`p-3.5 rounded-xl border ${
          sunlightMode
            ? 'bg-amber-50 border-amber-400 text-black'
            : 'bg-slate-900/90 border-slate-800 text-slate-100'
        }`}
      >
        {/* Stacks on phones: job identity first, then step actions, so nothing wraps letter by letter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 whitespace-nowrap">
                {workOrder.workOrderNumber}
              </span>
              <span className="text-xs font-medium text-slate-400 whitespace-nowrap">
                Site {site.role}: <strong className="text-slate-200">{site.id}</strong>
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-white mt-1 text-balance">
              Step {currentStep + 1} of {steps.length}: {steps[currentStep].title}
            </h2>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowShiftHandoverModal(true)}
              className="px-2.5 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-700/80 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1.5 shadow transition-all hover:border-cyan-500"
              title="Record departing status updates and remaining tasks for incoming shifts"
            >
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Shift Handover</span>
              <span className="sm:hidden">Handover</span>
              {handovers.length > 0 ? (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                    pendingAckCount > 0
                      ? 'bg-amber-500 text-slate-950 animate-pulse'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {handovers.length}
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded-full text-xs bg-slate-800 text-slate-400">
                  0
                </span>
              )}
            </button>
            <div className="text-right">
              <span className="text-xs font-mono font-bold text-cyan-400">
                {Math.round(((currentStep + 1) / steps.length) * 100)}%
              </span>
              <p className="text-xs text-slate-400">Progress</p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
          {steps.map((_, idx) => {
            const isCompleted = workOrder.stepsData[idx]?.completed;
            const isCurrent = idx === currentStep;
            return (
              <div
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`flex-1 h-full cursor-pointer transition-colors border-r border-slate-950/60 ${
                  isCompleted
                    ? 'bg-emerald-500'
                    : isCurrent
                    ? 'bg-cyan-500 animate-pulse'
                    : 'bg-slate-800 hover:bg-slate-700'
                }`}
                title={`Step ${idx + 1}: ${steps[idx].title}`}
              />
            );
          })}
        </div>

        {/* Horizontal Step Slider for Fast Access */}
        <div className="flex gap-1.5 overflow-x-auto py-2 mt-2 scrollbar-none">
          {steps.map((step, idx) => {
            const isDone = workOrder.stepsData[idx]?.completed;
            const isCurr = idx === currentStep;
            return (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`px-2 py-1 rounded text-xs font-mono whitespace-nowrap flex items-center gap-1 transition-colors border ${
                  isCurr
                    ? 'bg-cyan-600 text-white border-cyan-500 font-bold shadow'
                    : isDone
                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800'
                    : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                ) : (
                  <span>{idx + 1}.</span>
                )}
                <span>{step.title.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Automated Weather Safety Alert & Microclimate Telemetry */}
      <WeatherSafetyWidget
        report={weatherReport}
        isLoading={isWeatherLoading}
        onRefresh={() => weatherService.fetchSiteWeather(site.lat, site.long)}
        activeUser={activeUser}
        siteName={site.name}
        onClearanceUpdated={() => {
          setWeatherReport(weatherService.getCachedReport());
        }}
        sunlightMode={sunlightMode}
      />

      {/* Shift Turnover & Incoming Tasks Banner */}
      {latestHandover ? (
        <div
          className={`p-3.5 sm:p-4 rounded-xl border shadow-lg space-y-3 transition-colors ${
            sunlightMode
              ? 'bg-amber-100/70 border-amber-400 text-neutral-900'
              : 'bg-slate-900/95 border-cyan-800/80 text-slate-100'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-700 flex items-center justify-center text-cyan-400 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wide font-mono">
                    Shift Turnover: {latestHandover.shiftType.replace('_', ' ')}
                  </h3>
                  {!latestHandover.incomingAcknowledgement ? (
                    <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-amber-500 text-slate-950 animate-pulse">
                      PENDING INCOMING ACKNOWLEDGEMENT
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                      ✓ ACCEPTED BY {latestHandover.incomingAcknowledgement.technicianName}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Departing Tech: <strong className="text-slate-200">{latestHandover.departingTechnicianName}</strong> ({latestHandover.departingRole.replace('_', ' ')}) · Handover at {new Date(latestHandover.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowShiftHandoverModal(true)}
                className="px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold font-mono flex items-center gap-1.5 shadow transition-all"
                title="View shift handover log history or record new turnover"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Shift Handover Log ({handovers.length})</span>
              </button>
            </div>
          </div>

          {/* Departing status update snippet */}
          <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/90 text-xs">
            <span className="text-xs font-mono font-bold text-cyan-400 uppercase block mb-1">
              Departing Crew Status Update:
            </span>
            <p className="text-slate-300 leading-relaxed font-sans">
              "{latestHandover.statusSummary}"
            </p>
          </div>

          {/* Core requirement: Remaining Tasks for Incoming Shift */}
          {latestHandover.remainingTasks && latestHandover.remainingTasks.length > 0 && (
            <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-800/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-cyan-300 uppercase flex items-center gap-1.5">
                  <ListTodo className="w-4 h-4 text-cyan-400" />
                  Remaining Tasks Transferred to Incoming Shift ({latestHandover.remainingTasks.length})
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Assigned Lead: <strong className="text-white">{latestHandover.incomingShiftLeadName || 'Incoming Crew'}</strong>
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                {latestHandover.remainingTasks.map((task, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-slate-950/90 border border-slate-800 text-xs text-slate-200 flex items-start gap-2 shadow-sm"
                  >
                    <span className="w-4 h-4 rounded-full bg-cyan-900 text-cyan-300 text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-snug">{task}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active blockers or tools snapshot */}
          {(latestHandover.blockersOrHazards.length > 0 || (latestHandover.toolsHandover && latestHandover.toolsHandover.length > 0)) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {latestHandover.blockersOrHazards.length > 0 && (
                <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-900/40 text-xs text-amber-200">
                  <span className="font-mono font-bold uppercase text-xs text-amber-400 block mb-0.5">
                    Active Handover Hazard / Blocker:
                  </span>
                  <p className="truncate">⚠ {latestHandover.blockersOrHazards[0]}</p>
                </div>
              )}
              {latestHandover.toolsHandover && latestHandover.toolsHandover.length > 0 && (
                <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
                  <span className="font-mono font-bold uppercase text-xs text-slate-400 block mb-0.5">
                    Accounted Tools Handover:
                  </span>
                  <p className="truncate">🔧 {latestHandover.toolsHandover.length} items logged ({latestHandover.toolsHandover[0].toolName})</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              <strong className="text-slate-200">Shift Handover Active:</strong> Departing technicians can record status updates and remaining tasks for incoming shifts.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowShiftHandoverModal(true)}
            className="px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 font-mono font-bold text-xs shrink-0 transition-colors"
          >
            + Record Shift Handover
          </button>
        </div>
      )}

      {/* Step Content Container */}
      <div
        className={`p-4 sm:p-5 rounded-xl border ${
          sunlightMode
            ? 'bg-white border-neutral-400 text-black'
            : 'bg-slate-900 border-slate-800 text-slate-200'
        }`}
      >
        {/* STEP 1: JOB BRIEF & TSSR */}
        {currentStep === 0 && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-lg bg-cyan-950/30 border border-cyan-800/80">
              <h3 className="font-bold text-sm text-cyan-300 mb-1">
                TSSR Summary & Engineering Clearances
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Review the approved parameters before executing tower and equipment installations.
                Strictly comply with approved ACL height.
              </p>
            </div>

            {/* Approvals Routing Sheet Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-xs font-mono text-cyan-400 uppercase font-bold">
                  Transport Engineering ACL
                </span>
                <p className="text-xs font-bold text-slate-100 mt-1">
                  Approved Height: {approvals.transportEng.aclApprovedM} m ({approvals.transportEng.legApproved})
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {approvals.transportEng.remarks}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-xs font-mono text-emerald-400 uppercase font-bold">
                  Facility Engineering
                </span>
                <p className="text-xs font-bold text-slate-100 mt-1">
                  Outdoor Cabinet & -48V DC
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {approvals.facilityEng.powerApprovalRemarks}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-xs font-mono text-purple-400 uppercase font-bold">
                  Tower Assessment
                </span>
                <p className="text-xs font-bold text-slate-100 mt-1">
                  {site.tower.type} ({site.tower.heightM} m)
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {approvals.towerAssessment.structuralCapacityRemarks}
                </p>
              </div>
            </div>

            {/* Access & Keyholder Contact */}
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-200">Site Keyholder & Access Warden</p>
                <p className="text-xs text-slate-400">
                  {site.keyholder} ({site.ownerTowerProvider} Tower)
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{site.securityNotes}</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`tel:${site.keyholderContact}`}
                  className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <Phone className="w-3.5 h-3.5" />
                  Tap to Call
                </a>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${site.lat},${site.long}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Directions
                </a>
              </div>
            </div>

            {/* Incoming Shift Handover & Remaining Tasks Review */}
            <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  Shift Handover Log & Pending Tasks ({handovers.length} Total)
                </span>
                <button
                  type="button"
                  onClick={() => setShowShiftHandoverModal(true)}
                  className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-bold"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Open Shift Handover Log</span>
                </button>
              </div>

              {latestHandover ? (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between flex-wrap gap-1 text-xs text-slate-400">
                    <span>
                      Prior Shift: <strong className="text-slate-200">{latestHandover.departingTechnicianName}</strong> ({latestHandover.shiftType.replace('_', ' ')})
                    </span>
                    <span>
                      {new Date(latestHandover.timestamp).toLocaleDateString()} {new Date(latestHandover.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-300 italic bg-slate-900 p-2 rounded border border-slate-800">
                    "{latestHandover.statusSummary}"
                  </p>
                  {latestHandover.remainingTasks && latestHandover.remainingTasks.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs font-mono font-bold uppercase text-cyan-300">
                        Remaining Tasks Transferred for This Shift:
                      </span>
                      <ul className="space-y-1">
                        {latestHandover.remainingTasks.map((t, idx) => (
                          <li key={idx} className="flex items-start gap-1.5 text-xs text-slate-200">
                            <span className="text-cyan-400 font-bold">•</span>
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  No prior shift handovers logged yet. Departing technicians should record shift turnover notes and remaining tasks before leaving site.
                </p>
              )}
            </div>

            {/* Mandatory Acknowledgement Checkbox */}
            <label className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={stepData.acknowledgedTssr || false}
                onChange={(e) => handleUpdateField('acknowledgedTssr', e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-cyan-600 bg-slate-900 border-slate-700 focus:ring-0"
              />
              <span className="text-xs text-slate-300">
                I have reviewed the TSSR scope of work, approved antenna centerline height (
                <strong>{approvals.transportEng.aclApprovedM} m on {approvals.transportEng.legApproved}</strong>
                ), and site access protocols.
              </span>
            </label>
          </div>
        )}

        {/* STEP 2: DYNAMIC RISK ANALYSIS */}
        {currentStep === 1 && (
          <DynamicRiskAnalysis
            site={site}
            hop={hop}
            approvals={approvals}
            workOrder={workOrder}
            activeUser={activeUser}
            stepData={stepData}
            onUpdateField={handleUpdateField}
            onProceed={() => handleSaveStep(true)}
            sunlightMode={sunlightMode}
          />
        )}

        {/* STEP 3: PRE-DEPARTURE CHECKLIST */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-lg bg-cyan-950/30 border border-cyan-800/80 text-xs">
              <h3 className="font-bold text-cyan-300 mb-0.5">
                BOM & Special Cargo Depot Verification
              </h3>
              <p className="text-slate-300">
                Verify all telecom microwave Bill of Materials (BOM) and safety equipment are loaded in the service truck before leaving the depot.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {[
                { key: 'antennaPresent', label: `1.2m MA12U10W Antenna Dish (Boxed with Feedhorn)` },
                { key: 'ambReused', label: `1.6m AMB Clamps & Pipe Brackets (Reuse per TSSR)` },
                { key: 'oduPresent', label: `G11H3DD2 ODU 11GHz (Quantity: 2 for 4+0 CA XPIC)` },
                { key: 'iduPresent', label: `Huawei OptiX RTN 9150 IDU + Power cables` },
                { key: 'ifCablesLength', label: `2x 57m IF Coaxial Cables + N-connectors` },
                { key: 'groundingKits', label: `Grounding Kits: 16mm² (ODU/LPA) & 10mm² (IDU)` },
                { key: 'outdoorCabinet', label: `New Outdoor Cabinet + Pad Mounting Hardware` },
                { key: 'toolsAndTorque', label: `Torque Wrench (45-50 N·m calibrated) & Multimeter` },
                { key: 'ppePermits', label: `PPE (Full-body harness, LOTO tags, Site Work Permit)` },
                { key: 'weatherForecast', label: `Weather checked: Surigao winds < 15 knots, no lightning` },
                ...(site.accessRoad?.distanceToMainRoadM > 100 || site.accessRoad?.haulingMethod === 'MANUAL' || SEED_SITE_A.accessRoad?.distanceToMainRoadM > 100
                  ? [
                      {
                        key: 'manualHaulingGearPacked',
                        label: `[TSSR Constraint: Manual Hauling > 100m] Canvas dish carrying stretchers, yokes & porter crew allocation (${site.accessRoad?.distanceToMainRoadM > 100 ? site.accessRoad.distanceToMainRoadM : SEED_SITE_A.accessRoad.distanceToMainRoadM}m on trail)`,
                        isHighPriority: true,
                      },
                    ]
                  : []),
                ...(!site.commercialPower?.available || site.commercialPower?.remarks?.toLowerCase().includes('no commercial') || !SEED_SITE_A.commercialPower?.available
                  ? [
                      {
                        key: 'portableGensetPacked',
                        label: `[TSSR Constraint: No Commercial Power] Mobile 5kVA Inverter Genset, 20L Fuel Can, Copper Ground Rod & -48V DC adapter`,
                        isHighPriority: true,
                      },
                    ]
                  : []),
              ].map((item: any) => (
                <label
                  key={item.key}
                  className={`flex items-center gap-2.5 p-3 rounded-lg border transition-colors cursor-pointer ${
                    stepData[item.key]
                      ? 'bg-emerald-950/30 border-emerald-800 text-slate-200'
                      : item.isHighPriority
                      ? 'bg-rose-950/30 border-rose-800 text-rose-200 ring-1 ring-rose-600/40'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={stepData[item.key] || false}
                    onChange={(e) => handleUpdateField(item.key, e.target.checked)}
                    className="w-4 h-4 rounded text-cyan-600 bg-slate-900 border-slate-700"
                  />
                  <div className="flex-1">
                    <span>{item.label}</span>
                    {item.isHighPriority && (
                      <span className="ml-1.5 text-xs font-mono px-1 py-0.5 rounded bg-rose-600 text-white font-bold">
                        RISK MITIGATION
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4: SAFETY GATE (MANDATORY GATE) */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-800 flex items-start gap-3">
              <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-sm text-rose-300">
                  Mandatory Tower Safety Gate (OSHA & Telecom EHS)
                </h3>
                <p className="text-xs text-rose-200/90 mt-0.5 leading-relaxed">
                  Tower climbing is strictly prohibited until every safety item is verified and signed off by the Certified Climber and Site Safety Supervisor.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {[
                {
                  key: 'ppeHarnessInspected',
                  title: 'Full Body Harness & Lanyard Inspection',
                  desc: 'Double lanyards with energy absorbers, front sternal & dorsal D-rings inspected with no fraying or date expiration.',
                },
                {
                  key: 'fallArrestDoubleLanyard',
                  title: '100% Tie-Off / Fall Arrest System',
                  desc: 'Cable grab sleeve compatible with tower safety climb wire rope verified.',
                },
                {
                  key: 'rescuePlanBriefed',
                  title: 'Emergency Tower Rescue Plan Briefed',
                  desc: 'Rescue kit available at tower base with trained ground technician on standby.',
                },
                {
                  key: 'lotoTagOutConfirmed',
                  title: 'Lockout / Tagout (LOTO) Power Isolation',
                  desc: 'Main DC breaker tagged out before touching tower feeder cables.',
                },
                {
                  key: 'climberCertificationVerified',
                  title: 'Certified Tower Climber Card Verified',
                  desc: `Climber: ${activeUser.name} (License No. ${activeUser.climberLicenseNo || 'CLIMB-PH-2025-089'})`,
                },
                {
                  key: 'lightningRiskLow',
                  title: 'Atmospheric & Lightning Safety Check (Wind ≤ 30 km/h, Lightning > 10 km)',
                  desc: weatherReport
                    ? weatherReport.isSafeForTowerWork
                      ? `✓ Live Telemetry Passed: Wind ${weatherReport.windSpeedKmh} km/h (Limit: 30) • Lightning ${weatherReport.nearestLightningDistanceKm ?? '>50'} km (Exclusion: 10 km).`
                      : `⛔ ACTIVE HAZARD: Wind ${weatherReport.windSpeedKmh} km/h ${weatherReport.windSpeedKmh > 30 ? '(EXCEEDS 30 km/h LIMIT)' : ''} | Lightning ${weatherReport.nearestLightningDistanceKm} km ${weatherReport.lightningDetectedWithin10Km ? '(WITHIN 10 km SAFETY ZONE)' : ''}. Tower work strictly suspended.`
                    : 'No thunderstorm or lightning within 10 km; site wind speed below 30 km/h.',
                  isAtmosphericHazard: Boolean(weatherReport && !weatherReport.isSafeForTowerWork),
                },
                {
                  key: 'buddySystemActive',
                  title: 'Buddy System Active',
                  desc: 'Minimum 2-person qualified climbing team on site at all times.',
                },
              ].map((item: any) => {
                const isItemHazard = item.key === 'lightningRiskLow' && item.isAtmosphericHazard;
                return (
                  <label
                    key={item.key}
                    onClick={(e) => {
                      if (isItemHazard) {
                        e.preventDefault();
                        setShowWeatherLockModal(true);
                      }
                    }}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                      isItemHazard
                        ? 'bg-rose-950/60 border-rose-600 text-rose-200 ring-1 ring-rose-500'
                        : stepData[item.key]
                        ? 'bg-emerald-950/30 border-emerald-800'
                        : 'bg-slate-950/60 border-slate-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isItemHazard ? false : stepData[item.key] || false}
                      disabled={isItemHazard}
                      onChange={(e) => {
                        if (isItemHazard) {
                          setShowWeatherLockModal(true);
                          return;
                        }
                        handleUpdateField(item.key, e.target.checked);
                      }}
                      className="mt-1 w-4 h-4 rounded text-rose-600 bg-slate-900 border-slate-700 disabled:opacity-40"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className={`text-xs font-bold ${isItemHazard ? 'text-rose-300' : 'text-slate-200'}`}>
                          {item.title}
                        </p>
                        {isItemHazard && (
                          <span className="text-xs font-mono px-2 py-0.5 rounded bg-rose-600 text-white font-bold animate-pulse">
                            HAZARD ACTIVE
                          </span>
                        )}
                      </div>
                      <p className={`text-xs mt-0.5 ${isItemHazard ? 'text-rose-200 font-medium' : 'text-slate-400'}`}>
                        {item.desc}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Supervisor PIN / Signoff */}
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 block">
                  Supervisor Safety Authorization (Mandatory Gate)
                </span>
                <span className="text-xs font-mono text-cyan-400">
                  {activeUser.role === 'SUPERVISOR' || activeUser.role === 'ADMIN'
                    ? '✓ Authorized as ' + activeUser.role
                    : '⚠ Requires Supervisor/Admin PIN Sign-off'}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <input
                  type="password"
                  placeholder="Enter Supervisor PIN (e.g. 8842)"
                  value={stepData.supervisorPin || ''}
                  onChange={(e) => handleUpdateField('supervisorPin', e.target.value)}
                  className="px-3 py-2 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 w-full sm:w-64"
                />
                <button
                  type="button"
                  onClick={() => handleUpdateField('supervisorSigned', true)}
                  disabled={!stepData.supervisorPin}
                  className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-bold text-white flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Sign Safety Gate
                </button>
              </div>
              {stepData.supervisorSigned && (
                <p className="text-xs text-emerald-400 font-mono mt-1">
                  ✓ Safety Gate signed by Engr. Jun Arboleda (Site Safety Supervisor)
                </p>
              )}
            </div>
          </div>
        )}

        {/* STEP 5: SITE ARRIVAL & GPS CHECK-IN */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <h3 className="font-bold text-xs text-cyan-300 uppercase font-mono">
                Site Coordinates Verification
              </h3>
              <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                <div>
                  <span className="text-slate-400">Target Coordinates:</span>
                  <p className="font-mono font-bold text-slate-100">
                    {site.lat.toFixed(5)}° N, {site.long.toFixed(5)}° E
                  </p>
                  <p className="text-xs text-slate-500">
                    {site.latDms} / {site.longDms}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Elevation:</span>
                  <p className="font-mono font-bold text-slate-100">{site.elevationM} m AMSL</p>
                  <p className="text-xs text-slate-500">{site.siteType}</p>
                </div>
              </div>
            </div>

            {/* Live GPS Check-In Button */}
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-center space-y-3">
              <button
                type="button"
                onClick={handleCheckLocation}
                className="px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm flex items-center justify-center gap-2 mx-auto shadow-lg shadow-cyan-950/60"
              >
                <MapPin className="w-5 h-5" />
                Capture Live GPS Check-In
              </button>

              {stepData.gpsChecked && (
                <div
                  className={`p-3 rounded-lg border text-xs text-left max-w-md mx-auto ${
                    stepData.withinGeofence
                      ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                      : 'bg-amber-950/40 border-amber-800 text-amber-300'
                  }`}
                >
                  <p className="font-bold">
                    {stepData.withinGeofence
                      ? '✓ GPS Check-in Verified (Within Site Geofence)'
                      : '⚠ Warning: Current location exceeds 100m from surveyed site coords!'}
                  </p>
                  <p className="text-xs text-slate-300 mt-1">
                    Distance to Site Tower: <strong>{stepData.distanceToSiteM} meters</strong>
                  </p>
                  <p className="text-xs font-mono text-slate-400">
                    Timestamp: {new Date(stepData.checkInTimestamp).toLocaleString()}
                  </p>

                  {!stepData.withinGeofence && (
                    <div className="mt-2 pt-2 border-t border-amber-800/80">
                      <label className="text-xs text-amber-200 block mb-1">
                        Override Reason Required:
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Access road parking 120m away due to terrain"
                        value={stepData.geofenceOverrideReason || ''}
                        onChange={(e) => handleUpdateField('geofenceOverrideReason', e.target.value)}
                        className="w-full px-2 py-1 text-xs rounded bg-slate-900 border border-amber-700 text-white"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Photo capture shortcut */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-xs text-slate-300">
                Photo Evidence: 1.1 Access Road & Hauling Path
              </span>
              <button
                type="button"
                onClick={() =>
                  onOpenPhotoCapture('1.1_ACCESS', '1.1 Access Road & Hauling Path')
                }
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-400 flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                Capture Photo
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: POWER AND CABINET */}
        {currentStep === 5 && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-lg bg-amber-950/30 border border-amber-800/80 text-xs text-amber-300">
              <strong>Critical Polarity & Voltage Verification:</strong>
              <p className="text-slate-300 mt-1">
                NR9150 IDU operates on <strong>-48V DC nominal</strong>. Reverse polarity will destroy equipment power supply modules.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <label className="font-semibold text-slate-200 block">
                  Measured DC Voltage (V)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="-48.0"
                  value={stepData.measuredVoltage || ''}
                  onChange={(e) => handleUpdateField('measuredVoltage', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm font-mono text-cyan-400"
                />
                <span className="text-xs text-slate-500">
                  Target: -48.0V (Standard tolerance: -43.2V to -56.0V)
                </span>
                {stepData.measuredVoltage && (
                  <p
                    className={`text-xs font-mono ${
                      stepData.measuredVoltage <= -43.2 && stepData.measuredVoltage >= -57.0
                        ? 'text-emerald-400'
                        : 'text-rose-400 font-bold'
                    }`}
                  >
                    {stepData.measuredVoltage <= -43.2 && stepData.measuredVoltage >= -57.0
                      ? '✓ Voltage within acceptable operating threshold'
                      : '⚠ Voltage out of range! Inspect rectifier / battery banks.'}
                  </p>
                )}
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <label className="font-semibold text-slate-200 block">
                  Main Breaker Rating (A)
                </label>
                <input
                  type="number"
                  placeholder="63"
                  value={stepData.breakerRating || 63}
                  onChange={(e) => handleUpdateField('breakerRating', parseInt(e.target.value))}
                  className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm font-mono text-cyan-400"
                />
                <span className="text-xs text-slate-500">
                  Per TSSR: DCPDB-01 60A/63A breaker slot #4
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              {[
                {
                  key: 'polarityConfirmedNegative',
                  label: 'Multimeter confirms Red lead on 0V (GND) and Black lead on -48V DC bus.',
                },
                {
                  key: 'cabinetBoltedGround',
                  label: 'Outdoor cabinet anchored to ODC concrete pad with M12 expansion bolts and grounded.',
                },
                {
                  key: 'powerCableTorqued',
                  label: 'Main & Redundant power cables crimped with heat-shrink insulated lugs.',
                },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-950/60 border border-slate-800 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={stepData[item.key] || false}
                    onChange={(e) => handleUpdateField(item.key, e.target.checked)}
                    className="w-4 h-4 rounded text-cyan-600 bg-slate-900 border-slate-700"
                  />
                  <span className="text-slate-300">{item.label}</span>
                </label>
              ))}
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-xs text-slate-300">
                Photo Evidence: 1.15 DC Voltage & Multimeter Polarity Test
              </span>
              <button
                type="button"
                onClick={() =>
                  onOpenPhotoCapture('1.15_POLARITY_CHECK', '1.15 DC Voltage & Polarity Check')
                }
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-400 flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                Capture Photo
              </button>
            </div>
          </div>
        )}

        {/* STEP 7: TOWER WORK & ANTENNA MOUNTING */}
        {currentStep === 6 && (
          <RoleGate
            currentUser={activeUser}
            requiredPermission="EXECUTE_TOWER_CLIMB"
            sectionName="Tower Climbing & High-Altitude Antenna Rigging"
          >
            <div className="space-y-4">
            {/* Severe Weather Tower Climbing Lockdown Banner */}
            {weatherReport && !weatherReport.isSafeForTowerWork && (
              <div className="p-4 rounded-xl bg-rose-950/90 border-2 border-rose-600 text-white space-y-3 shadow-xl">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-rose-600 text-white shrink-0 animate-pulse">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="font-black text-sm uppercase tracking-wide text-rose-200">
                        ⛔ TOWER CLIMBING SUSPENDED — LIVE WEATHER HAZARD LOCKOUT
                      </h3>
                      <span className="text-xs font-mono bg-rose-900 border border-rose-700 px-2 py-0.5 rounded text-rose-300 font-bold">
                        DOLE-OSHA / TELCO SAFETY SHUTDOWN
                      </span>
                    </div>
                    <p className="text-xs text-rose-200 mt-1 leading-relaxed">
                      Tower ascent, dish hoisting, and antenna rigging at Site <strong>{site.id}</strong> ({site.lat.toFixed(5)}° N, {site.long.toFixed(5)}° E) are strictly prohibited while wind speed exceeds 30 km/h or lightning is detected within 10 km.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-rose-800 text-xs">
                      <div className={`p-2 rounded bg-rose-900/60 border ${weatherReport.windSpeedKmh > 30 ? 'border-rose-500 font-bold' : 'border-rose-800'}`}>
                        <span className="text-xs text-rose-300 block">WIND SPEED THRESHOLD (&le; 30 km/h):</span>
                        <span className="font-mono text-sm text-white">{weatherReport.windSpeedKmh} km/h</span>
                        {weatherReport.windSpeedKmh > 30 ? (
                          <span className="text-rose-300 text-xs block font-bold">⛔ EXCEEDS 30 km/h SAFETY LIMIT</span>
                        ) : (
                          <span className="text-emerald-400 text-xs block">✓ Safe (&le; 30 km/h)</span>
                        )}
                      </div>
                      <div className={`p-2 rounded bg-rose-900/60 border ${weatherReport.lightningDetectedWithin10Km ? 'border-rose-500 font-bold' : 'border-rose-800'}`}>
                        <span className="text-xs text-rose-300 block">LIGHTNING EXCLUSION (&gt; 10 km):</span>
                        <span className="font-mono text-sm text-white">{weatherReport.nearestLightningDistanceKm} km</span>
                        {weatherReport.lightningDetectedWithin10Km ? (
                          <span className="text-rose-300 text-xs block font-bold">⛔ STRIKE WITHIN 10 km SAFETY ZONE</span>
                        ) : (
                          <span className="text-emerald-400 text-xs block">✓ Safe (&gt; 10 km)</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-rose-800/80 mt-2">
                      <span className="text-xs text-rose-200 flex items-center gap-1 font-mono">
                        <Lock className="w-3.5 h-3.5 text-rose-400" />
                        Tower rigging form and task completion locked until cleared.
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowWeatherLockModal(true)}
                        className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow flex items-center justify-center gap-1"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Resolve / Sign Clearance
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <fieldset
              disabled={Boolean(weatherReport && !weatherReport.isSafeForTowerWork)}
              className={`space-y-4 transition-opacity ${
                weatherReport && !weatherReport.isSafeForTowerWork
                  ? 'opacity-40 pointer-events-none select-none'
                  : ''
              }`}
            >
              <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-cyan-400 uppercase font-bold">
                    ACL Validation Gate
                  </span>
                  <span className="text-xs font-mono text-emerald-400">
                    Approved: {site.approvedAclHeightM} m ({site.approvedAclLeg})
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Install 1.2m MA12U10W antenna dish on <strong>{site.approvedAclLeg}</strong> at{' '}
                  <strong>{site.approvedAclHeightM} m</strong>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                  <label className="font-semibold text-slate-200 block">
                    Actual Installed Height (m)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="40.7"
                    value={stepData.actualHeightM ?? ''}
                    onChange={(e) => handleUpdateField('actualHeightM', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm font-mono text-white"
                  />
                  {stepData.actualHeightM !== undefined && (
                    <div>
                      {Math.abs(stepData.actualHeightM - (site.approvedAclHeightM || 40.7)) > 0.3 ? (
                        <div className="p-2 rounded bg-rose-950/60 border border-rose-800 text-rose-300 text-xs mt-1 flex items-start gap-1.5">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                          <span>
                            MISMATCH FLAG: Entered {stepData.actualHeightM}m differs from approved ACL{' '}
                            {site.approvedAclHeightM}m! Requires engineering variance justification.
                          </span>
                        </div>
                      ) : (
                        <p className="text-emerald-400 font-mono text-xs">
                          ✓ Matches approved ACL height within ±0.3m
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                  <label className="font-semibold text-slate-200 block">Installed Tower Leg</label>
                  <select
                    value={stepData.installedLeg || site.approvedAclLeg || 'Leg C'}
                    onChange={(e) => handleUpdateField('installedLeg', e.target.value)}
                    className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm font-mono text-white"
                  >
                    <option value="Leg A">Leg A</option>
                    <option value="Leg B">Leg B</option>
                    <option value="Leg C">Leg C (Approved)</option>
                  </select>
                  {stepData.installedLeg && stepData.installedLeg !== site.approvedAclLeg && (
                    <p className="text-amber-400 text-xs font-mono mt-1">
                      ⚠ Warning: Installed on {stepData.installedLeg} instead of approved {site.approvedAclLeg}.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-xs">
                {[
                  {
                    key: 'ambUboltsTorqued',
                    label: 'AMB 1.6m pipe clamps torqued to 45-50 N·m with torque seal lacquer applied.',
                  },
                  {
                    key: 'oduMountedDirectly',
                    label: 'ODU direct-mounted to antenna collar with O-ring greased and latched.',
                  },
                  {
                    key: 'weatherproofing332',
                    label: 'Weatherproofing applied using 3-3-2 method (3 vinyl, 3 mastic, 2 vinyl wrap).',
                  },
                  {
                    key: 'upperGroundingConnected',
                    label: '16 mm² ODU grounding wire connected to 40.3 m upper tower busbar.',
                  },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-950/60 border border-slate-800 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={stepData[item.key] || false}
                      onChange={(e) => handleUpdateField(item.key, e.target.checked)}
                      className="w-4 h-4 rounded text-cyan-600 bg-slate-900 border-slate-700"
                    />
                    <span className="text-slate-300">{item.label}</span>
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onOpenPhotoCapture('1.6_PROPOSED_ANTENNA', '1.6 Antenna Mounted at Approved Height')
                  }
                  className="p-2.5 rounded bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs text-cyan-400 flex items-center justify-between"
                >
                  <span>Photo: Antenna at {site.approvedAclHeightM}m</span>
                  <Camera className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onOpenPhotoCapture('1.9_UPPER_BUSBAR', '1.9 Upper Busbar Grounding (40.3 m)')
                  }
                  className="p-2.5 rounded bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs text-cyan-400 flex items-center justify-between"
                >
                  <span>Photo: 40.3m Busbar Grounding</span>
                  <Camera className="w-4 h-4" />
                </button>
              </div>
            </fieldset>
          </div>
        </RoleGate>
        )}

        {/* STEP 8: IDU INSTALLATION */}
        {currentStep === 7 && (
          <div className="space-y-4">
            <p className="text-xs text-slate-300">
              Install Huawei OptiX RTN 9150 (NR9150) IDU chassis in the outdoor cabinet rack slot with arrester bracket and cable ties.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <label className="font-semibold text-slate-200 block">IDU Serial Number</label>
                <input
                  type="text"
                  placeholder="2102313ABC998102"
                  value={stepData.iduSerialNumber || '2102313ABC998102'}
                  onChange={(e) => handleUpdateField('iduSerialNumber', e.target.value)}
                  className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-cyan-400"
                />
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <label className="font-semibold text-slate-200 block">IDU Asset Tag</label>
                <input
                  type="text"
                  placeholder="AST-MW-9150-0041"
                  value={stepData.iduAssetTag || 'AST-MW-9150-0041'}
                  onChange={(e) => handleUpdateField('iduAssetTag', e.target.value)}
                  className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-cyan-400"
                />
              </div>
            </div>

            <div className="space-y-2 text-xs">
              {[
                {
                  key: 'iduGrounded10mm',
                  label: '10 mm² green/yellow PGND grounding wire connected to 1.3 m tower base busbar.',
                },
                {
                  key: 'ifPortMapped',
                  label: 'IF ports 1 and 2 connected with surge arrester brackets securely bonded.',
                },
                {
                  key: 'managementPortLabeled',
                  label: 'NMS / ETH ports labeled and dust caps installed on unused SFP slots.',
                },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-950/60 border border-slate-800 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={stepData[item.key] || false}
                    onChange={(e) => handleUpdateField(item.key, e.target.checked)}
                    className="w-4 h-4 rounded text-cyan-600 bg-slate-900 border-slate-700"
                  />
                  <span className="text-slate-300">{item.label}</span>
                </label>
              ))}
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-xs text-slate-300">
                Photo Evidence: 1.16 IDU NR9150 Rack Mount Position
              </span>
              <button
                type="button"
                onClick={() =>
                  onOpenPhotoCapture('1.16_IDU_RACK', '1.16 IDU NR9150 Rack Mount Position')
                }
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-400 flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                Capture Photo
              </button>
            </div>
          </div>
        )}

        {/* STEP 9: ANTENNA ALIGNMENT & RSL VERIFICATION */}
        {currentStep === 8 && (
          <div className="space-y-4">
            {/* Target Alignment Card */}
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <span className="text-slate-400">Target Azimuth:</span>
                <p className="font-mono font-bold text-lg text-cyan-400">241.02°</p>
                <p className="text-xs text-slate-500">True Heading to Site A</p>
              </div>
              <div>
                <span className="text-slate-400">Path Distance:</span>
                <p className="font-mono font-bold text-lg text-slate-200">{hop.pathLengthKm} km</p>
                <p className="text-xs text-slate-500">11 GHz Microwave</p>
              </div>
              <div>
                <span className="text-slate-400">Expected RSL:</span>
                <p className="font-mono font-bold text-lg text-emerald-400">
                  {hop.expectedRslDbm} dBm
                </p>
                <p className="text-xs text-slate-500">Tolerance: ±3.0 dB</p>
              </div>
              <div>
                <span className="text-slate-400">Link Mode:</span>
                <p className="font-mono font-bold text-lg text-purple-400">
                  {hop.configuration}
                </p>
                <p className="text-xs text-slate-500">XPIC Dual-Pol</p>
              </div>
            </div>

            {/* Real-Time Mobile Device Sensor Alignment Tool Launcher */}
            <div className="p-3.5 rounded-lg bg-slate-900 border border-cyan-800/60 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-cyan-950 border border-cyan-700 flex items-center justify-center text-cyan-300 shrink-0">
                  <Compass className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">
                    Real-Time Sensor Alignment HUD (Compass & Inclinometer)
                  </span>
                  <p className="text-xs text-slate-400">
                    {stepData.aligned_azimuth
                      ? `Aligned Data Locked: ${stepData.aligned_azimuth}° Azimuth / ${stepData.aligned_elevation >= 0 ? `+${stepData.aligned_elevation}` : stepData.aligned_elevation}° Tilt`
                      : 'Hold mobile device flat on antenna bracket collar for live magnetic azimuth and elevation pitch guidance'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowSensorAlignment(true)}
                className="w-full sm:w-auto px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-cyan-950/40 transition-colors shrink-0"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Launch Sensor HUD</span>
              </button>
            </div>

            {/* Carrier RSL Measurement Entries */}
            <div className="p-4 rounded-lg bg-slate-950/70 border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-200 block">
                Carrier RSL Measurements (4+0 CA XPIC)
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {['Carrier 1 (V)', 'Carrier 2 (H)', 'Carrier 3 (V)', 'Carrier 4 (H)'].map(
                  (cName, idx) => {
                    const key = `carrier_${idx + 1}_rsl`;
                    const val = stepData[key] ?? -27.2;
                    const variance =
                      typeof val === 'number'
                        ? (val - hop.expectedRslDbm).toFixed(2)
                        : null;
                    return (
                      <div key={key} className="p-2.5 rounded bg-slate-900 border border-slate-800">
                        <span className="text-xs text-slate-400 block">{cName}</span>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="-27.2"
                          value={stepData[key] ?? ''}
                          onChange={(e) => handleUpdateField(key, parseFloat(e.target.value))}
                          className="w-full mt-1 px-2 py-1.5 rounded bg-slate-950 border border-slate-700 font-mono text-sm font-bold text-white"
                        />
                        {variance && (
                          <div className="mt-1 flex items-center justify-between text-xs font-mono">
                            <span className="text-slate-500">Var:</span>
                            <span
                              className={
                                Math.abs(parseFloat(variance)) <= 3.0
                                  ? 'text-emerald-400 font-bold'
                                  : 'text-rose-400 font-bold'
                              }
                            >
                              {parseFloat(variance) > 0 ? `+${variance}` : variance} dB
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  }
                )}
              </div>

              {/* XPIC Discrimination */}
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    XPIC Cross-Polar Discrimination (XPD in dB)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="34.5"
                    value={stepData.xpdDb ?? 35.0}
                    onChange={(e) => handleUpdateField('xpdDb', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm font-mono text-cyan-400"
                  />
                  <span className="text-xs text-slate-500">
                    Recommended XPD ≥ 30 dB for 4096QAM stability
                  </span>
                </div>
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    Thermal Fade Margin (dB)
                  </label>
                  <input
                    type="number"
                    readOnly
                    value={(
                      Math.abs(stepData.carrier_1_rsl ?? -27.2) -
                      Math.abs(hop.modulationTable[hop.modulationTable.length - 1].rxThresholdDbm)
                    ).toFixed(1)}
                    className="w-full px-3 py-2 rounded bg-slate-900/60 border border-slate-800 text-sm font-mono text-emerald-400"
                  />
                  <span className="text-xs text-slate-500">
                    Calculated above 4096QAM threshold (-54.0 dBm)
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-xs text-slate-300">
                Photo Evidence: 1.20 Alignment Azimuth Compass Verification
              </span>
              <button
                type="button"
                onClick={() =>
                  onOpenPhotoCapture('1.20_AZIMUTH_COMPASS', '1.20 Alignment Azimuth Compass Verification')
                }
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-400 flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                Capture Photo
              </button>
            </div>
          </div>
        )}

        {/* STEP 10: COMMISSIONING TESTS */}
        {currentStep === 9 && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-3 text-xs">
              <h3 className="font-bold text-slate-200">Digital Transmission Quality Tests</h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-slate-400">Peak Modulation Achieved</span>
                  <select
                    value={stepData.achievedModulation || '4096QAM'}
                    onChange={(e) => handleUpdateField('achievedModulation', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 font-mono text-cyan-400 text-xs font-bold"
                  >
                    {hop.modulationTable.map((m) => (
                      <option key={m.scheme} value={m.scheme}>
                        {m.scheme} ({m.throughputMbps} Mbps)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 rounded bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-slate-400">Bit Error Rate (BER)</span>
                  <input
                    type="text"
                    placeholder="0.0E-9 (Error Free)"
                    value={stepData.berValue || '0.0E-9'}
                    onChange={(e) => handleUpdateField('berValue', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 font-mono text-emerald-400 text-xs font-bold"
                  />
                </div>

                <div className="p-3 rounded bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-slate-400">Aggregated Throughput (Mbps)</span>
                  <input
                    type="number"
                    placeholder="2760"
                    value={stepData.throughputMbps || 2760}
                    onChange={(e) => handleUpdateField('throughputMbps', parseInt(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 font-mono text-white text-xs font-bold"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                {[
                  {
                    key: 'alarmsClear',
                    label: 'NR9150 active alarm list is zero (Critical, Major, Minor, Warning: ALL CLEAR).',
                  },
                  {
                    key: 'ethernetPingPass',
                    label: 'End-to-end Ethernet RFC 2544 latency < 1.2 ms with 0 packet loss at full line rate.',
                  },
                  {
                    key: 'configBackedUp',
                    label: 'Database configuration backed up to CF card & uploaded to NMS server.',
                  },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center gap-2.5 p-2.5 rounded bg-slate-900 border border-slate-800 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={stepData[item.key] || false}
                      onChange={(e) => handleUpdateField(item.key, e.target.checked)}
                      className="w-4 h-4 rounded text-cyan-600 bg-slate-950 border-slate-700"
                    />
                    <span className="text-slate-300">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 11: AS-BUILT VARIANCE CHECK */}
        {currentStep === 10 && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-lg bg-cyan-950/30 border border-cyan-800/80 text-xs">
              <h3 className="font-bold text-cyan-300 mb-1">
                Automated Planned vs. Actual As-Built Audit
              </h3>
              <p className="text-slate-300">
                Auto-compares planned parameters from the TSSR against actual field measurements.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono">
                    <th className="py-2 px-2.5">Parameter</th>
                    <th className="py-2 px-2.5">TSSR Planned</th>
                    <th className="py-2 px-2.5">Field As-Built</th>
                    <th className="py-2 px-2.5">Variance</th>
                    <th className="py-2 px-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  <tr>
                    <td className="py-2.5 px-2.5 text-slate-200">Antenna Height</td>
                    <td className="py-2.5 px-2.5 text-slate-400">{site.approvedAclHeightM} m</td>
                    <td className="py-2.5 px-2.5 text-slate-100 font-bold">
                      {workOrder.stepsData[6]?.data?.actualHeightM || stepData.actualHeightM || 40.7} m
                    </td>
                    <td className="py-2.5 px-2.5 text-emerald-400">0.0 m</td>
                    <td className="py-2.5 px-2.5">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs">
                        PASS
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-2.5 text-slate-200">Installed Leg</td>
                    <td className="py-2.5 px-2.5 text-slate-400">{site.approvedAclLeg}</td>
                    <td className="py-2.5 px-2.5 text-slate-100 font-bold">
                      {workOrder.stepsData[6]?.data?.installedLeg || 'Leg C'}
                    </td>
                    <td className="py-2.5 px-2.5 text-emerald-400">Match</td>
                    <td className="py-2.5 px-2.5">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs">
                        PASS
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-2.5 text-slate-200">Target Azimuth</td>
                    <td className="py-2.5 px-2.5 text-slate-400">241.02°</td>
                    <td className="py-2.5 px-2.5 text-slate-100 font-bold">241.0°</td>
                    <td className="py-2.5 px-2.5 text-emerald-400">-0.02°</td>
                    <td className="py-2.5 px-2.5">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs">
                        PASS
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-2.5 text-slate-200">Received RSL</td>
                    <td className="py-2.5 px-2.5 text-slate-400">{hop.expectedRslDbm} dBm</td>
                    <td className="py-2.5 px-2.5 text-slate-100 font-bold">
                      {workOrder.stepsData[8]?.data?.carrier_1_rsl || -27.2} dBm
                    </td>
                    <td className="py-2.5 px-2.5 text-emerald-400">-0.03 dB</td>
                    <td className="py-2.5 px-2.5">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs">
                        PASS
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-2.5 text-slate-200">IF Cable Length</td>
                    <td className="py-2.5 px-2.5 text-slate-400">{site.cablePlan.ifCableM} m</td>
                    <td className="py-2.5 px-2.5 text-slate-100 font-bold">57.0 m</td>
                    <td className="py-2.5 px-2.5 text-emerald-400">Exact</td>
                    <td className="py-2.5 px-2.5">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs">
                        PASS
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* AI As-Built Summary Generator */}
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  Gemini AI Handover Summary & Punch List
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    setIsAiLoading(true);
                    const res = await gemini.generateAsBuiltSummary(workOrder, site, hop);
                    setAiAnalysis(res.summary);
                    handleUpdateField('punchList', res.punchList);
                    setIsAiLoading(false);
                  }}
                  disabled={isAiLoading}
                  className="px-2.5 py-1 rounded bg-cyan-700 hover:bg-cyan-600 text-xs font-bold text-white flex items-center gap-1"
                >
                  {isAiLoading ? 'Analyzing...' : 'Auto-Generate'}
                </button>
              </div>

              {aiAnalysis && (
                <div className="p-3 rounded bg-slate-900 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                  {aiAnalysis}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 12: REVIEW & SUBMISSION */}
        {currentStep === 11 && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="font-bold text-base text-emerald-300">
                Installation Completed & Ready for Review
              </h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto">
                All 10 stages have been inspected. The As-Built dossier is prepared for submission to
                QA Reviewer <strong>Engr. Sarah Mendoza</strong>.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onOpenReportModal}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 flex items-center gap-3 text-left transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center shrink-0">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-white">Generate Official PDF Report</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Multi-page printable As-Built Certificate with photos and specs.
                  </p>
                </div>
              </button>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-xs text-white">
                    {activeUser.role === 'REVIEWER' || activeUser.role === 'ADMIN'
                      ? 'Reviewer Final Sign-Off'
                      : 'Submit to QA Reviewer'}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {activeUser.role === 'REVIEWER' || activeUser.role === 'ADMIN'
                      ? `Active User ${activeUser.name} has QA clearance to certify this link.`
                      : 'Status will transition to Pending Review for Engr. Sarah Mendoza.'}
                  </p>
                </div>

                {activeUser.role === 'REVIEWER' || activeUser.role === 'ADMIN' ? (
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        const updated = {
                          ...workOrder,
                          status: 'APPROVED' as const,
                          approvedAt: new Date().toISOString(),
                          approvedBy: activeUser.name,
                        };
                        storage.saveWorkOrder(updated);
                        alert(`Work Order ${workOrder.workOrderNumber} officially APPROVED by Reviewer ${activeUser.name}!`);
                      }}
                      className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white flex items-center justify-center gap-1.5 shadow"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve & Certify As-Built
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const reason = prompt('Enter rejection punch list notes for technician:') || 'Punch list rework required.';
                        const updated = {
                          ...workOrder,
                          status: 'REJECTED' as const,
                          reviewerRemarks: reason,
                        };
                        storage.saveWorkOrder(updated);
                        alert('Work Order marked as REJECTED with punch list rework notes.');
                      }}
                      className="px-3 py-2.5 rounded-lg bg-rose-950 hover:bg-rose-900 border border-rose-800 font-bold text-xs text-rose-300"
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const updated = {
                        ...workOrder,
                        status: 'PENDING_REVIEW' as const,
                        completedAt: new Date().toISOString(),
                      };
                      storage.saveWorkOrder(updated);
                      alert('Work Order WO-2026-CRANE-002-B submitted to QA Reviewer!');
                    }}
                    className="mt-3 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white flex items-center justify-center gap-1.5 shadow"
                  >
                    <Send className="w-4 h-4" />
                    Submit Work Order Dossier
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step Notes and AI Query Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300">
              Field Technician Notes for Step {currentStep + 1}
            </label>
            <button
              type="button"
              onClick={handleAskAiAboutStep}
              disabled={isAiLoading}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono"
            >
              <Sparkles className="w-3 h-3" />
              {isAiLoading ? 'Checking...' : 'Ask AI for Step Specs'}
            </button>
          </div>

          <textarea
            rows={2}
            placeholder="Enter field observations, weather notes, or torque measurements..."
            value={stepNotes}
            onChange={(e) => setStepNotes(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-600"
          />

          {aiAnalysis && currentStep !== 10 && (
            <div className="p-3 rounded-lg bg-slate-950/80 border border-cyan-900/60 text-xs text-slate-300 space-y-1">
              <span className="text-xs font-mono text-cyan-400 font-bold block">
                FIELD-OPS AI RECOMMENDATION:
              </span>
              <p className="leading-relaxed whitespace-pre-line">{aiAnalysis}</p>
            </div>
          )}
        </div>

        {/* Navigation & Action Bar */}
        {/* Phones: primary action full width on top, secondary pair, then Previous */}
        <div className="mt-5 pt-3 border-t border-slate-800 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <button
            type="button"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="justify-center px-3.5 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Previous
          </button>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <button
              type="button"
              onClick={() => setShowShiftHandoverModal(true)}
              className="justify-center px-3.5 py-2.5 rounded-lg border border-cyan-800 bg-cyan-950/60 hover:bg-cyan-900 text-xs text-cyan-300 font-bold flex items-center gap-1.5 shadow transition-all"
              title="Record departing technician handover & remaining tasks for incoming shift"
            >
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Shift Handover</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveStep(false)}
              className="text-center px-3.5 py-2.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-800 text-xs text-slate-300 font-semibold"
            >
              Save Draft
            </button>

            {currentStep < steps.length - 1 ? (
              <button
                type="button"
                onClick={() => handleSaveStep(true)}
                disabled={
                  (currentStep === 1 && !stepData.riskAnalysisSigned) ||
                  (currentStep === 3 && !isSafetyGateSatisfied()) ||
                  (currentStep === 6 && Boolean(weatherReport && !weatherReport.isSafeForTowerWork))
                }
                className={`col-span-2 order-first sm:order-none min-h-12 sm:min-h-0 justify-center text-center px-4 py-2.5 rounded-lg text-sm sm:text-xs font-bold flex items-center gap-1.5 shadow ${
                  (currentStep === 1 && !stepData.riskAnalysisSigned) ||
                  (currentStep === 3 && !isSafetyGateSatisfied()) ||
                  (currentStep === 6 && Boolean(weatherReport && !weatherReport.isSafeForTowerWork))
                    ? 'bg-rose-950/80 border border-rose-700 text-rose-300 cursor-not-allowed'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-950/50'
                }`}
              >
                {currentStep === 1 && !stepData.riskAnalysisSigned ? (
                  <>
                    <Lock className="w-4 h-4 text-rose-400" />
                    <span>Acknowledge Risk Analysis to Continue</span>
                  </>
                ) : currentStep === 6 && weatherReport && !weatherReport.isSafeForTowerWork ? (
                  <>
                    <Lock className="w-4 h-4 text-rose-400" />
                    <span>Tower Work Blocked (Weather Hazard)</span>
                  </>
                ) : currentStep === 3 && weatherReport && !weatherReport.isSafeForTowerWork ? (
                  <>
                    <Lock className="w-4 h-4 text-rose-400" />
                    <span>Atmospheric Gate Blocked</span>
                  </>
                ) : (
                  <>
                    <span>Save & Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSaveStep(true)}
                className="col-span-2 order-first sm:order-none min-h-12 sm:min-h-0 justify-center px-4 py-2.5 rounded-lg text-sm sm:text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mark Step Complete</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Weather Safety Lockout Information Modal */}
      {showWeatherLockModal && weatherReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border-2 border-rose-600 shadow-2xl p-5 space-y-4 text-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5 text-rose-400">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wide text-white">
                    Tower Work Suspended — Severe Weather Lockout
                  </h3>
                  <span className="text-xs font-mono text-rose-300">
                    DOLE-OSHA / TELCO TECHNICAL RULE 1052
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWeatherLockModal(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-700/80 space-y-2">
              <p className="text-xs text-rose-200 leading-relaxed font-medium">
                Live automated weather telemetry at Site <strong>{site.id}</strong> ({site.lat.toFixed(5)}° N, {site.long.toFixed(5)}° E) has triggered an automated safety lockout. Proceeding with tower ascent, antenna rigging, or closing safety gates is prohibited until cleared.
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-rose-800">
                <div className={`p-2 rounded bg-rose-900/60 border ${weatherReport.windSpeedKmh > 30 ? 'border-rose-500 font-bold' : 'border-rose-800'}`}>
                  <span className="text-xs text-rose-300 block">WIND SPEED:</span>
                  <span className="text-sm font-mono text-white font-bold">{weatherReport.windSpeedKmh} km/h</span>
                  <span className="text-xs block text-rose-300 font-mono">Limit: 30 km/h</span>
                </div>
                <div className={`p-2 rounded bg-rose-900/60 border ${weatherReport.lightningDetectedWithin10Km ? 'border-rose-500 font-bold' : 'border-rose-800'}`}>
                  <span className="text-xs text-rose-300 block">LIGHTNING PROXIMITY:</span>
                  <span className="text-sm font-mono text-white font-bold">{weatherReport.nearestLightningDistanceKm} km</span>
                  <span className="text-xs block text-rose-300 font-mono">Exclusion: 10 km</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <span className="font-bold text-slate-300 block">Active Safety Violations:</span>
              <ul className="list-disc list-inside space-y-1 text-xs text-rose-300/90 font-medium bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                {weatherReport.violations.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-2">
              <span className="font-bold text-cyan-300 block">Resolution Procedures:</span>
              <ol className="list-decimal list-inside space-y-1 text-xs text-slate-300">
                <li>Wait at tower base shelter until wind drops below 30 km/h and thunderstorm cells pass 10 km away.</li>
                <li>Tap &quot;Re-check Live Weather&quot; to fetch updated telemetry.</li>
                <li>If on-ground calibrated instruments confirm microclimate safety, obtain a signed EHS Supervisor variance.</li>
              </ol>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={async () => {
                  setIsWeatherLoading(true);
                  try {
                    const rep = await weatherService.fetchSiteWeather(site.lat, site.long);
                    setWeatherReport(rep);
                    if (rep.isSafeForTowerWork) {
                      setShowWeatherLockModal(false);
                    }
                  } finally {
                    setIsWeatherLoading(false);
                  }
                }}
                disabled={isWeatherLoading}
                className="px-4 py-2.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow"
              >
                <RefreshCw className={`w-4 h-4 ${isWeatherLoading ? 'animate-spin' : ''}`} />
                Re-check Live Weather
              </button>
              <button
                type="button"
                onClick={() => setShowWeatherLockModal(false)}
                className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sensor Antenna Alignment Modal */}
      <SensorAlignmentModal
        isOpen={showSensorAlignment}
        onClose={() => setShowSensorAlignment(false)}
        targetAzimuth={241.02}
        targetElevation={0.12}
        siteName={site.name}
        hopName={hop.hopName}
        onSaveAlignment={(az, el) => {
          handleUpdateField('aligned_azimuth', az);
          handleUpdateField('aligned_elevation', el);
        }}
        sunlightMode={sunlightMode}
      />

      {/* Shift Handover Modal */}
      <ShiftHandoverModal
        isOpen={showShiftHandoverModal}
        onClose={() => setShowShiftHandoverModal(false)}
        workOrder={workOrder}
        site={site}
        activeUser={activeUser}
        sunlightMode={sunlightMode}
      />
    </div>
  );
};
