import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  X,
  UserCheck,
  Plus,
  Trash2,
  ShieldAlert,
  Send,
  FileText,
  BatteryCharging,
  Wind,
  CheckSquare,
  Square,
  Wrench,
  PenTool,
  ArrowRight,
  Sparkles,
  Calendar,
  Layers,
  History,
  Copy,
  Printer,
  HardHat,
} from 'lucide-react';
import {
  WorkOrder,
  Site,
  UserProfile,
  ShiftHandoverLog,
  HandoverToolItem,
} from '../../types/fieldops';
import { storage } from '../../services/storageService';
import { deviceBatteryService } from '../../services/deviceBatteryService';
import { weatherService, WeatherSafetyReport } from '../../services/weatherService';

interface ShiftHandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder: WorkOrder;
  site: Site;
  activeUser: UserProfile;
  sunlightMode: boolean;
}

export const ShiftHandoverModal: React.FC<ShiftHandoverModalProps> = ({
  isOpen,
  onClose,
  workOrder,
  site,
  activeUser,
  sunlightMode,
}) => {
  const [activeTab, setActiveTab] = useState<'NEW_LOG' | 'HISTORY'>('NEW_LOG');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Form states for New Shift Handover
  const [shiftType, setShiftType] = useState<
    'DAY_SHIFT' | 'AFTERNOON_SHIFT' | 'NIGHT_SHIFT' | 'TOWER_CLIMB_ROTATION' | 'WEATHER_STANDBY'
  >('DAY_SHIFT');
  const [incomingShiftLeadName, setIncomingShiftLeadName] = useState('Danilo Reyes');
  const [statusSummary, setStatusSummary] = useState(
    `Work Order ${workOrder.workOrderNumber} at Site ${workOrder.siteRole} (${site.id}): Step ${workOrder.currentStepIndex + 1} in progress. Equipment mounted, handover for tower alignment.`
  );

  // Completed items list
  const [completedItems, setCompletedItems] = useState<string[]>([
    'Pre-climb safety gate inspected & signed off',
    `Antenna mount secured at approved ACL ${site.approvedAclHeightM || 40.7}m on ${site.approvedAclLeg || 'Leg C'}`,
    'IF coaxial cables run from shelter to 35m tower tray',
    'ODU surge grounding lug tightened to tower busbar',
  ]);
  const [newCompletedInput, setNewCompletedInput] = useState('');

  // Remaining tasks list (Core requirement)
  const [remainingTasks, setRemainingTasks] = useState<string[]>([
    'Perform fine azimuth alignment to target 241.02°',
    'Measure RSL and calibrate to target -27.17 dBm',
    'Verify IF cable weatherproofing & cold shrink boot installation',
    'Clean up tower base staging area and log reclaimed scrap',
  ]);
  const [newRemainingInput, setNewRemainingInput] = useState('');

  // Blockers / Hazards list
  const [blockersOrHazards, setBlockersOrHazards] = useState<string[]>([
    'Afternoon thunderstorm advisory active along Siargao coastal path',
    'Leg C lower ladder rung #14 has grease residue from rigging hoist',
  ]);
  const [newHazardInput, setNewHazardInput] = useState('');

  // Tools & Inventory Handover
  const [toolsHandover, setToolsHandover] = useState<HandoverToolItem[]>([
    { toolName: 'Digital Gyro Inclinometer', condition: 'OPERATIONAL', location: 'Tower Top Tool Bag (Leg C 40m)' },
    { toolName: 'Torque Wrench (10-60 Nm)', condition: 'OPERATIONAL', location: 'Ground Shelter Work Bench' },
    { toolName: 'Fall-Arrest Double Lanyards (ANSI)', condition: 'OPERATIONAL', location: 'Staging Area' },
    { toolName: 'Spectrum Analyzer / Multimeter', condition: 'OPERATIONAL', location: 'Vehicle 2 Storage Bin' },
  ]);
  const [newToolName, setNewToolName] = useState('');
  const [newToolLocation, setNewToolLocation] = useState('Shelter Work Bench');
  const [newToolCondition, setNewToolCondition] = useState<'OPERATIONAL' | 'NEEDS_INSPECTION' | 'DEPLETED' | 'MISSING'>('OPERATIONAL');

  // Departing technician signature
  const [signature, setSignature] = useState(activeUser.name || '');

  // Live telemetry snapshots
  const [liveBattery, setLiveBattery] = useState(deviceBatteryService.getState());
  const [liveWeather, setLiveWeather] = useState<WeatherSafetyReport | null>(weatherService.getCachedReport());

  // Acknowledging log state
  const [acknowledgingLogId, setAcknowledgingLogId] = useState<string | null>(null);
  const [ackNotes, setAckNotes] = useState('Inspected staged tools and confirmed remaining tasks. Handover accepted.');

  // Subscribe to live telemetry and storage changes
  useEffect(() => {
    if (!isOpen) return;
    const unsubBattery = deviceBatteryService.subscribe(setLiveBattery);
    const unsubWeather = weatherService.subscribe(setLiveWeather);
    return () => {
      unsubBattery();
      unsubWeather();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const currentHandovers = workOrder.shiftHandovers || [];
  const pendingAckCount = currentHandovers.filter((h) => !h.incomingAcknowledgement).length;

  const handleAddCompletedItem = () => {
    if (!newCompletedInput.trim()) return;
    setCompletedItems([...completedItems, newCompletedInput.trim()]);
    setNewCompletedInput('');
  };

  const handleRemoveCompletedItem = (index: number) => {
    setCompletedItems(completedItems.filter((_, i) => i !== index));
  };

  const handleAddRemainingTask = () => {
    if (!newRemainingInput.trim()) return;
    setRemainingTasks([...remainingTasks, newRemainingInput.trim()]);
    setNewRemainingInput('');
  };

  const handleRemoveRemainingTask = (index: number) => {
    setRemainingTasks(remainingTasks.filter((_, i) => i !== index));
  };

  const handleAddHazard = () => {
    if (!newHazardInput.trim()) return;
    setBlockersOrHazards([...blockersOrHazards, newHazardInput.trim()]);
    setNewHazardInput('');
  };

  const handleRemoveHazard = (index: number) => {
    setBlockersOrHazards(blockersOrHazards.filter((_, i) => i !== index));
  };

  const handleAddTool = () => {
    if (!newToolName.trim()) return;
    setToolsHandover([
      ...toolsHandover,
      {
        toolName: newToolName.trim(),
        location: newToolLocation.trim() || 'Shelter Work Bench',
        condition: newToolCondition,
      },
    ]);
    setNewToolName('');
  };

  const handleRemoveTool = (index: number) => {
    setToolsHandover(toolsHandover.filter((_, i) => i !== index));
  };

  const handleSubmitHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusSummary.trim() || remainingTasks.length === 0 || !signature.trim()) {
      alert('Please provide a status summary, at least one remaining task for the incoming shift, and your signature.');
      return;
    }

    setIsSubmitting(true);
    try {
      await storage.addShiftHandoverLog(workOrder.id, {
        workOrderId: workOrder.id,
        workOrderNumber: workOrder.workOrderNumber,
        siteId: site.id,
        siteRole: workOrder.siteRole,
        shiftType,
        incomingShiftLeadName: incomingShiftLeadName.trim() || undefined,
        incomingShiftLeadRole: 'TECHNICIAN',
        statusSummary: statusSummary.trim(),
        completedItems,
        remainingTasks,
        blockersOrHazards,
        toolsHandover,
        batteryLevelAtHandover: liveBattery.level,
        batteryHealthAtHandover: liveBattery.healthStatus,
        weatherConditionAtHandover: liveWeather
          ? `${liveWeather.weatherCondition} · Wind ${liveWeather.windSpeedKmh} km/h (Shear: ${liveWeather.windTowerHeightKmh} km/h) · Vis ${liveWeather.visibilityKm} km`
          : 'Partly Cloudy · Wind 14 km/h',
        windSpeedKmhAtHandover: liveWeather?.windSpeedKmh || 14.0,
        departingSignature: signature.trim(),
      });

      setSuccessBanner(
        `✓ Shift handover logged successfully! ${remainingTasks.length} task(s) transferred to incoming shift (${incomingShiftLeadName}).`
      );
      setTimeout(() => {
        setActiveTab('HISTORY');
        setSuccessBanner(null);
      }, 1200);
    } catch (err: any) {
      alert(`Failed to save shift handover: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmAcknowledgment = async (logId: string) => {
    try {
      await storage.acknowledgeShiftHandover(workOrder.id, logId, ackNotes);
      setAcknowledgingLogId(null);
      setSuccessBanner('✓ Shift handover officially acknowledged & accepted by incoming crew.');
      setTimeout(() => setSuccessBanner(null), 3000);
    } catch (err: any) {
      alert(`Acknowledgment error: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div
        className={`w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col my-auto transition-colors ${
          sunlightMode
            ? 'bg-amber-50 border-amber-300 text-neutral-900'
            : 'bg-slate-900 border-slate-700 text-slate-100'
        }`}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-700/80 bg-gradient-to-r from-cyan-950/60 via-slate-900 to-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/30 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shrink-0 shadow-inner">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Field Technician Shift Handover Log
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                  JOB MODULE
                </span>
                {pendingAckCount > 0 && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500 text-slate-950 animate-pulse">
                    {pendingAckCount} PENDING ACK
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Work Order: <strong className="text-cyan-300">{workOrder.workOrderNumber}</strong> · Site {workOrder.siteRole}: <strong className="text-slate-200">{site.id}</strong> ({site.name})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex p-0.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
              <button
                type="button"
                onClick={() => setActiveTab('NEW_LOG')}
                className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                  activeTab === 'NEW_LOG'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Record Handover
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('HISTORY')}
                className={`px-3 py-1.5 rounded-md font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'HISTORY'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Log History ({currentHandovers.length})</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Success Banner */}
        {successBanner && (
          <div className="bg-emerald-950 border-b border-emerald-700 px-5 py-2.5 text-xs text-emerald-200 font-bold flex items-center gap-2 shadow-inner">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successBanner}</span>
          </div>
        )}

        {/* Modal Body Content */}
        <div className="p-4 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* TAB 1: RECORD NEW SHIFT HANDOVER */}
          {activeTab === 'NEW_LOG' && (
            <form onSubmit={handleSubmitHandover} className="space-y-4">
              {/* Operator & Live Conditions Context Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Departing Field Operator:
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-6 h-6 rounded-md bg-cyan-700 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {activeUser.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-white leading-tight">{activeUser.name}</p>
                      <p className="text-[10px] text-cyan-400">{activeUser.role.replace('_', ' ')}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Handheld Device Telemetry:
                  </span>
                  <div className="flex items-center gap-2 mt-1 text-slate-200">
                    <BatteryCharging className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-emerald-400">{liveBattery.level}% Charge</span>
                    <span className="text-slate-400">({liveBattery.healthStatus})</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Live Atmospheric Shear:
                  </span>
                  <div className="flex items-center gap-2 mt-1 text-slate-200">
                    <Wind className="w-4 h-4 text-cyan-400" />
                    <span>{liveWeather?.windSpeedKmh || 14} km/h</span>
                    <span className="text-slate-400">(45m: {liveWeather?.windTowerHeightKmh || 21} km/h)</span>
                  </div>
                </div>
              </div>

              {/* Shift Configuration Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1 font-bold">
                    1. Shift Rotation Type
                  </label>
                  <select
                    value={shiftType}
                    onChange={(e) => setShiftType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:border-cyan-500 outline-none"
                  >
                    <option value="DAY_SHIFT">Day Shift (06:00 - 14:00 · Logistics & Cable Runs)</option>
                    <option value="AFTERNOON_SHIFT">Afternoon Shift (14:00 - 22:00 · Tower Rigging)</option>
                    <option value="NIGHT_SHIFT">Night Shift (22:00 - 06:00 · Commissioning & Maintenance)</option>
                    <option value="TOWER_CLIMB_ROTATION">Tower Climb Rotation (Climber Fatigue / Rigging Swap)</option>
                    <option value="WEATHER_STANDBY">Weather Standby (Rain / Wind Safety Paused)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1 font-bold">
                    2. Incoming Shift Lead / Technician
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Danilo Reyes / Team Leader"
                    value={incomingShiftLeadName}
                    onChange={(e) => setIncomingShiftLeadName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                    required
                  />
                </div>
              </div>

              {/* Status Update Summary */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-mono text-slate-400 font-bold">
                    3. Work Order Status Update Summary
                  </label>
                  <span className="text-[10px] text-cyan-400 font-mono">
                    Current Step: #{workOrder.currentStepIndex + 1}
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={statusSummary}
                  onChange={(e) => setStatusSummary(e.target.value)}
                  placeholder="Record what was done during your shift, current stage of installation or maintenance, and critical notes..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 placeholder-slate-600 focus:border-cyan-500 outline-none font-sans"
                  required
                />
              </div>

              {/* 4. REMAINING TASKS FOR INCOMING SHIFT (Core Requirement) */}
              <div className="p-4 rounded-xl bg-slate-950 border border-cyan-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wide flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4 text-cyan-400" />
                      4. Remaining Tasks for Incoming Shift ({remainingTasks.length})
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Explicit instructions and pending milestones incoming technicians must execute.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                    REQUIRED
                  </span>
                </div>

                {/* Remaining task input bar */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Fine-tune azimuth to 241.02° using compass and RSL dial..."
                    value={newRemainingInput}
                    onChange={(e) => setNewRemainingInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddRemainingTask())}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddRemainingTask}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold font-mono flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Task</span>
                  </button>
                </div>

                {/* Remaining tasks list */}
                <ul className="space-y-1.5">
                  {remainingTasks.map((task, idx) => (
                    <li
                      key={idx}
                      className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2 text-xs text-slate-200"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="w-4 h-4 rounded-full bg-cyan-950 text-cyan-300 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 border border-cyan-800">
                          {idx + 1}
                        </span>
                        <span className="leading-snug">{task}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveRemainingTask(idx)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded"
                        title="Remove task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 5. Completed Items & Accomplishments */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    5. Completed Items During Departing Shift ({completedItems.length})
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Grounding kit terminated into 40.3m busbar..."
                    value={newCompletedInput}
                    onChange={(e) => setNewCompletedInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCompletedItem())}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddCompletedItem}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold font-mono flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <ul className="space-y-1">
                  {completedItems.map((item, idx) => (
                    <li
                      key={idx}
                      className="px-2.5 py-1.5 rounded-md bg-slate-900 text-xs text-slate-300 flex items-center justify-between gap-2"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">{item}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCompletedItem(idx)}
                        className="text-slate-500 hover:text-rose-400 p-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 6. Active Hazards & Safety Roadblocks */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-amber-900/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    6. Active Hazards & Safety Roadblocks ({blockersOrHazards.length})
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Wet ladder rungs near 20m platform; high wind warning..."
                    value={newHazardInput}
                    onChange={(e) => setNewHazardInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddHazard())}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-amber-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddHazard}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 rounded-lg text-xs font-bold font-mono flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Hazard</span>
                  </button>
                </div>

                <ul className="space-y-1">
                  {blockersOrHazards.map((hazard, idx) => (
                    <li
                      key={idx}
                      className="px-2.5 py-1.5 rounded-md bg-amber-950/30 border border-amber-900/50 text-xs text-amber-200 flex items-center justify-between gap-2"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate">{hazard}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveHazard(idx)}
                        className="text-amber-500 hover:text-rose-400 p-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 7. Tools & Equipment Handover Ledger */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <h3 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                  <Wrench className="w-4 h-4 text-cyan-400" />
                  7. Equipment & Special Tools Handover ({toolsHandover.length})
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    placeholder="Tool name (e.g. Inclinometer)"
                    value={newToolName}
                    onChange={(e) => setNewToolName(e.target.value)}
                    className="sm:col-span-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Location (e.g. Shelter Bench)"
                    value={newToolLocation}
                    onChange={(e) => setNewToolLocation(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddTool}
                    className="bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-xs font-bold rounded-lg px-2.5 py-1.5 flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Tool</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {toolsHandover.map((tool, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-[11px]"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-bold text-white block truncate">{tool.toolName}</span>
                        <span className="text-slate-400 text-[10px] truncate block">Loc: {tool.location}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                          {tool.condition}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTool(idx)}
                          className="text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 8. Departing Technician Digital Signature */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                    <PenTool className="w-4 h-4 text-cyan-400" />
                    8. Departing Technician Digital Signature
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Signing certifies accurate remaining tasks and safe equipment condition.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    placeholder="Sign your full name"
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-cyan-300 font-bold focus:border-cyan-400 outline-none"
                    required
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs shadow-lg shadow-cyan-950 flex items-center gap-2 disabled:opacity-50 transition-all shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Recording Handover...' : 'Record Shift Handover'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 2: SHIFT HANDOVER LOG HISTORY */}
          {activeTab === 'HISTORY' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <History className="w-4 h-4 text-cyan-400" />
                    Work Order Shift Handover Audit Ledger
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Chronological shift rotations recorded by departing technicians on {workOrder.workOrderNumber}.
                  </p>
                </div>

                <button
                  onClick={() => setActiveTab('NEW_LOG')}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Record New Handover</span>
                </button>
              </div>

              {currentHandovers.length === 0 ? (
                <div className="p-8 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-2">
                  <Clock className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-300">No Shift Handovers Recorded Yet</p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Departing technicians can record remaining tasks and current site status for incoming shifts.
                  </p>
                  <button
                    onClick={() => setActiveTab('NEW_LOG')}
                    className="mt-2 px-4 py-2 rounded-lg bg-cyan-600 text-white font-mono text-xs font-bold"
                  >
                    Record First Handover
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentHandovers.map((log) => {
                    const isAcknowledged = Boolean(log.incomingAcknowledgement);
                    return (
                      <div
                        key={log.id}
                        className={`rounded-2xl border p-4 sm:p-5 space-y-3.5 transition-all ${
                          isAcknowledged
                            ? 'bg-slate-950/80 border-slate-800'
                            : 'bg-slate-950 border-amber-600/80 ring-1 ring-amber-500/30'
                        }`}
                      >
                        {/* Handover Card Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`p-2 rounded-xl text-xs font-bold font-mono ${
                                isAcknowledged
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : 'bg-amber-950 text-amber-400 border border-amber-700 animate-pulse'
                              }`}
                            >
                              <Clock className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-sm">
                                  {log.shiftType.replace('_', ' ')}
                                </span>
                                <span
                                  className={`px-2 py-0.2 rounded text-[10px] font-mono font-bold ${
                                    isAcknowledged
                                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                                      : 'bg-amber-950 text-amber-300 border border-amber-600'
                                  }`}
                                >
                                  {isAcknowledged ? 'ACKNOWLEDGED' : 'PENDING INCOMING ACCEPTANCE'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                                Logged by <strong className="text-slate-200">{log.departingTechnicianName}</strong> ({log.departingRole.replace('_', ' ')}) on {new Date(log.timestamp).toLocaleString()}
                              </p>
                            </div>
                          </div>

                          {/* Telemetry pill */}
                          <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400">
                            {log.batteryLevelAtHandover && (
                              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-400">
                                🔋 {log.batteryLevelAtHandover}%
                              </span>
                            )}
                            {log.windSpeedKmhAtHandover && (
                              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-400">
                                💨 {log.windSpeedKmhAtHandover} km/h
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status Summary */}
                        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
                          <span className="text-[10px] font-mono text-cyan-400 font-bold block uppercase mb-1">
                            Shift Status Update:
                          </span>
                          <p className="text-slate-200 leading-relaxed">{log.statusSummary}</p>
                        </div>

                        {/* Remaining Tasks Section (Core Highlight) */}
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-mono font-bold text-cyan-400 uppercase tracking-wide flex items-center gap-1.5">
                            <CheckSquare className="w-3.5 h-3.5" />
                            Remaining Tasks for Incoming Shift ({log.remainingTasks.length}):
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {log.remainingTasks.map((task, tidx) => (
                              <div
                                key={tidx}
                                className="p-2.5 rounded-lg bg-cyan-950/20 border border-cyan-800/40 text-xs text-slate-200 flex items-start gap-2"
                              >
                                <span className="w-4 h-4 rounded-full bg-cyan-900 text-cyan-300 font-mono text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                  {tidx + 1}
                                </span>
                                <span className="leading-snug">{task}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Completed Items & Hazards side-by-side */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          {/* Completed */}
                          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                            <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase block">
                              Completed Items ({log.completedItems.length}):
                            </span>
                            <ul className="space-y-1 text-slate-300 text-[11px]">
                              {log.completedItems.map((c, cidx) => (
                                <li key={cidx} className="flex items-start gap-1.5">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                                  <span>{c}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Hazards */}
                          <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/40 space-y-1">
                            <span className="text-[10px] font-mono text-amber-400 font-bold uppercase block">
                              Hazards & Roadblocks ({log.blockersOrHazards.length}):
                            </span>
                            <ul className="space-y-1 text-amber-200 text-[11px]">
                              {log.blockersOrHazards.map((h, hidx) => (
                                <li key={hidx} className="flex items-start gap-1.5">
                                  <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                                  <span>{h}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Tools Custody */}
                        {log.toolsHandover && log.toolsHandover.length > 0 && (
                          <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800 text-[11px]">
                            <span className="text-[10px] font-mono text-slate-400 font-bold block mb-1">
                              Tools & Staged Equipment ({log.toolsHandover.length}):
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {log.toolsHandover.map((t, tidx) => (
                                <span
                                  key={tidx}
                                  className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[10px]"
                                >
                                  {t.toolName} ({t.location}) ·{' '}
                                  <strong className="text-emerald-400">{t.condition}</strong>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Handover Signoff & Incoming Acknowledgment Bar */}
                        <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
                          <div className="text-slate-400">
                            Departing Signature: <strong className="text-white font-sans">{log.departingSignature}</strong>
                          </div>

                          {/* Incoming acknowledgment section */}
                          {isAcknowledged ? (
                            <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-[11px] flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>
                                Acknowledged by <strong>{log.incomingAcknowledgement?.technicianName}</strong> on{' '}
                                {new Date(log.incomingAcknowledgement?.acknowledgedAt || '').toLocaleTimeString()}
                              </span>
                            </div>
                          ) : acknowledgingLogId === log.id ? (
                            <div className="p-3 rounded-xl bg-slate-900 border border-amber-600/80 space-y-2 w-full sm:w-auto">
                              <span className="text-[10px] text-amber-300 font-bold block uppercase">
                                Incoming Shift Acknowledgment:
                              </span>
                              <input
                                type="text"
                                value={ackNotes}
                                onChange={(e) => setAckNotes(e.target.value)}
                                placeholder="Acceptance notes..."
                                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                              />
                              <div className="flex items-center gap-2 justify-end">
                                <button
                                  type="button"
                                  onClick={() => setAcknowledgingLogId(null)}
                                  className="px-2 py-1 text-slate-400 hover:text-white text-[11px]"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleConfirmAcknowledgment(log.id)}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded flex items-center gap-1"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Sign & Accept Handover</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setAcknowledgingLogId(log.id);
                                setAckNotes(`Acknowledged by ${activeUser.name}. Tools verified, accepting remaining tasks.`);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Acknowledge & Accept Handover</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
