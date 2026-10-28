import React, { useState, useMemo } from 'react';
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  Award,
  ShieldCheck,
  Briefcase,
  ChevronRight,
  Filter,
  Search,
  Zap,
  ArrowRight,
  Clock,
  Radio,
  MapPin,
  Check,
  UserPlus,
  UserMinus,
  Sparkles,
  BarChart2,
  SlidersHorizontal,
} from 'lucide-react';
import { WorkOrder, UserProfile, Site, Hop, UserRole } from '../../types/fieldops';
import { storage } from '../../services/storageService';

interface ResourceAllocationWidgetProps {
  workOrders: WorkOrder[];
  sites?: Site[];
  hops?: Hop[];
  sunlightMode: boolean;
  onSelectWorkOrder?: (wo: WorkOrder) => void;
  onNavigateToJobs?: () => void;
}

interface RequiredSkillProfile {
  title: string;
  mandatoryCerts: string[];
  recommendedCerts: string[];
  requiresClimberLicense: boolean;
  suggestedRoles: UserRole[];
}

export const ResourceAllocationWidget: React.FC<ResourceAllocationWidgetProps> = ({
  workOrders,
  sites = [],
  hops = [],
  sunlightMode,
  onSelectWorkOrder,
  onNavigateToJobs,
}) => {
  const allUsers = storage.getAllUsers();
  const fieldCrew = useMemo(
    () =>
      allUsers.filter((u) =>
        ['TECHNICIAN', 'TOWER_CLIMBER', 'TEAM_LEADER', 'SUPERVISOR'].includes(u.role)
      ),
    [allUsers]
  );

  // Selected work order for skill-based matching
  const [selectedWoId, setSelectedWoId] = useState<string>(() => {
    const pendingOrder = workOrders.find(
      (wo) => wo.status === 'ASSIGNED' || wo.status === 'SCHEDULED' || wo.status === 'DRAFT'
    );
    return pendingOrder?.id || workOrders[0]?.id || '';
  });

  const [roleFilter, setRoleFilter] = useState<'ALL' | 'TECHNICIAN' | 'TOWER_CLIMBER' | 'TEAM_LEADER' | 'SUPERVISOR'>('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState<'ALL' | 'AVAILABLE' | 'ON_DUTY'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const selectedWorkOrder = useMemo(
    () => workOrders.find((w) => w.id === selectedWoId) || workOrders[0] || null,
    [workOrders, selectedWoId]
  );

  // Compute live crew assignments map
  const crewWorkloadMap = useMemo(() => {
    const map = new Map<string, { activeOrders: WorkOrder[]; totalTasks: number }>();
    fieldCrew.forEach((c) => {
      const assigned = workOrders.filter((wo) => wo.assigneeIds.includes(c.id));
      map.set(c.id, {
        activeOrders: assigned,
        totalTasks: assigned.length,
      });
    });
    return map;
  }, [workOrders, fieldCrew]);

  // Skill requirement profile for the selected work order
  const requiredSkills: RequiredSkillProfile = useMemo(() => {
    if (!selectedWorkOrder) {
      return {
        title: 'General Microwave Field Task',
        mandatoryCerts: ['Working at Heights Level 2'],
        recommendedCerts: ['RF Hazard Safety'],
        requiresClimberLicense: true,
        suggestedRoles: ['TECHNICIAN', 'TOWER_CLIMBER'],
      };
    }

    if (selectedWorkOrder.type === 'INSTALLATION') {
      return {
        title: 'Microwave Hop Link Installation & Rigging',
        mandatoryCerts: ['Working at Heights Level 2', 'Microwave Installation Specialist'],
        recommendedCerts: ['RF Hazard Safety', 'Anritsu Site Master VSWR Certified'],
        requiresClimberLicense: true,
        suggestedRoles: ['TOWER_CLIMBER', 'TECHNICIAN', 'TEAM_LEADER'],
      };
    } else if (selectedWorkOrder.type === 'DISMANTLING') {
      return {
        title: 'High-Altitude Tower Decommissioning & Winch Rigging',
        mandatoryCerts: ['Working at Heights Level 2', 'Heavy Rigging & Winch Operations'],
        recommendedCerts: ['First Aid Responder', 'Certified Tower Climber & Rescue'],
        requiresClimberLicense: true,
        suggestedRoles: ['TOWER_CLIMBER', 'SUPERVISOR'],
      };
    } else {
      return {
        title: 'Precision RF Link Diagnostics & Sweep Tuning',
        mandatoryCerts: ['Microwave Link Alignment Specialist'],
        recommendedCerts: ['Anritsu Site Master VSWR Certified', 'RF Hazard Safety'],
        requiresClimberLicense: false,
        suggestedRoles: ['TECHNICIAN', 'TEAM_LEADER'],
      };
    }
  }, [selectedWorkOrder]);

  // Skill-based matching score calculation
  const scoredCrew = useMemo(() => {
    return fieldCrew.map((crew) => {
      let score = 0;
      const matchedMandatory: string[] = [];
      const missingMandatory: string[] = [];
      const matchedRecommended: string[] = [];

      // 1. Role match (up to 25 pts)
      if (requiredSkills.suggestedRoles.includes(crew.role)) {
        score += 25;
      } else {
        score += 10;
      }

      // 2. Mandatory Certifications match (up to 40 pts)
      const userCerts = crew.certifications || [];
      requiredSkills.mandatoryCerts.forEach((reqCert) => {
        const hasCert = userCerts.some(
          (c) => c.toLowerCase().includes(reqCert.toLowerCase()) || reqCert.toLowerCase().includes(c.toLowerCase())
        );
        if (hasCert) {
          score += 20;
          matchedMandatory.push(reqCert);
        } else {
          missingMandatory.push(reqCert);
        }
      });

      // 3. Recommended Certifications match (up to 20 pts)
      requiredSkills.recommendedCerts.forEach((recCert) => {
        const hasCert = userCerts.some(
          (c) => c.toLowerCase().includes(recCert.toLowerCase()) || recCert.toLowerCase().includes(c.toLowerCase())
        );
        if (hasCert) {
          score += 10;
          matchedRecommended.push(recCert);
        }
      });

      // 4. Climber License Requirement (10 pts)
      if (requiredSkills.requiresClimberLicense) {
        if (crew.climberLicenseNo) {
          score += 10;
        } else {
          score -= 10;
        }
      } else {
        score += 5;
      }

      // 5. Availability bonus (5 pts)
      const load = crewWorkloadMap.get(crew.id)?.totalTasks || 0;
      if (crew.status === 'AVAILABLE' || load === 0) {
        score += 5;
      } else if (load >= 2) {
        score -= 5;
      }

      const normalizedScore = Math.max(10, Math.min(100, score));

      const isAssigned = selectedWorkOrder?.assigneeIds.includes(crew.id) || false;

      return {
        crew,
        score: normalizedScore,
        matchedMandatory,
        missingMandatory,
        matchedRecommended,
        isAssigned,
        activeWorkload: load,
      };
    });
  }, [fieldCrew, requiredSkills, selectedWorkOrder, crewWorkloadMap]);

  // Filtered and sorted crew list
  const filteredCrew = useMemo(() => {
    return scoredCrew
      .filter(({ crew }) => {
        if (roleFilter !== 'ALL' && crew.role !== roleFilter) return false;
        if (availabilityFilter === 'AVAILABLE' && crew.status !== 'AVAILABLE') return false;
        if (availabilityFilter === 'ON_DUTY' && crew.status !== 'ON_DUTY') return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = crew.name.toLowerCase().includes(q);
          const matchSpecial = (crew.specialization || '').toLowerCase().includes(q);
          const matchCerts = (crew.certifications || []).some((c) => c.toLowerCase().includes(q));
          return matchName || matchSpecial || matchCerts;
        }
        return true;
      })
      .sort((a, b) => {
        // Assigned crew first, then by match score descending
        if (a.isAssigned && !b.isAssigned) return -1;
        if (!a.isAssigned && b.isAssigned) return 1;
        return b.score - a.score;
      });
  }, [scoredCrew, roleFilter, availabilityFilter, searchQuery]);

  // Overall resource allocation KPIs
  const totalFieldCrew = fieldCrew.length;
  const onDutyCount = fieldCrew.filter((c) => c.status === 'ON_DUTY' || (crewWorkloadMap.get(c.id)?.totalTasks || 0) > 0).length;
  const availableCount = totalFieldCrew - onDutyCount;
  const certifiedClimbersCount = fieldCrew.filter((c) => c.climberLicenseNo).length;
  const pendingOrdersWithoutCrew = workOrders.filter(
    (wo) => wo.status !== 'APPROVED' && wo.status !== 'CLOSED' && wo.assigneeIds.length === 0
  ).length;

  const handleToggleAssign = async (crewId: string, isAssigned: boolean) => {
    if (!selectedWorkOrder) return;

    let updatedAssignees: string[];
    if (isAssigned) {
      updatedAssignees = selectedWorkOrder.assigneeIds.filter((id) => id !== crewId);
    } else {
      updatedAssignees = [...selectedWorkOrder.assigneeIds, crewId];
    }

    const assignedCrew = allUsers.find((u) => u.id === crewId);
    const updatedWo: WorkOrder = {
      ...selectedWorkOrder,
      assigneeIds: updatedAssignees,
      history: [
        ...selectedWorkOrder.history,
        {
          timestamp: new Date().toISOString(),
          userId: storage.getActiveUser().id,
          userName: storage.getActiveUser().name,
          action: isAssigned ? 'CREW_UNASSIGNED' : 'CREW_ASSIGNED',
          note: isAssigned
            ? `Unassigned ${assignedCrew?.name || crewId} from work order.`
            : `Assigned ${assignedCrew?.name || crewId} via Skill-Based Matching (${assignedCrew?.role}).`,
        },
      ],
    };

    await storage.saveWorkOrder(updatedWo);
    setActionFeedback(
      isAssigned
        ? `Removed ${assignedCrew?.name} from ${selectedWorkOrder.workOrderNumber}.`
        : `Assigned ${assignedCrew?.name} to ${selectedWorkOrder.workOrderNumber} (Skill Match Verified).`
    );
    setTimeout(() => setActionFeedback(null), 3500);
  };

  const handleAutoAssignOptimalCrew = async () => {
    if (!selectedWorkOrder) return;

    // Pick top 2 scored candidates that have climber license if needed
    const sorted = [...scoredCrew].sort((a, b) => b.score - a.score);
    const optimalAssignees: string[] = [];

    // 1. One lead climber/rigger with license
    const leadClimber = sorted.find((s) => s.crew.climberLicenseNo);
    if (leadClimber) optimalAssignees.push(leadClimber.crew.id);

    // 2. One commissioning technician or team leader
    const secondTech = sorted.find((s) => !optimalAssignees.includes(s.crew.id));
    if (secondTech) optimalAssignees.push(secondTech.crew.id);

    const updatedWo: WorkOrder = {
      ...selectedWorkOrder,
      assigneeIds: optimalAssignees,
      history: [
        ...selectedWorkOrder.history,
        {
          timestamp: new Date().toISOString(),
          userId: storage.getActiveUser().id,
          userName: storage.getActiveUser().name,
          action: 'AUTO_SKILL_MATCH_ALLOCATION',
          note: `Project Manager triggered automated skill-based matching. Assigned ${optimalAssignees.length} optimal crew members.`,
        },
      ],
    };

    await storage.saveWorkOrder(updatedWo);
    setActionFeedback(
      `Auto-matched and assigned ${optimalAssignees.length} certified personnel to ${selectedWorkOrder.workOrderNumber}.`
    );
    setTimeout(() => setActionFeedback(null), 4000);
  };

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 space-y-4 shadow-xl transition-colors ${
        sunlightMode
          ? 'bg-neutral-50 border-neutral-300 text-neutral-900'
          : 'bg-slate-900/95 border-slate-800 text-slate-100'
      }`}
    >
      {/* Header & Mission Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0 shadow-inner mt-0.5">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight uppercase">
                Resource Allocation & Crew Matching
              </h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 font-bold">
                PM MISSION CONTROL
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live field technician deployment, high-altitude climber license tracking, and automated skill-based work order matching.
            </p>
          </div>
        </div>

        {actionFeedback && (
          <div className="px-3 py-1.5 rounded-lg bg-emerald-950/90 border border-emerald-700 text-emerald-300 text-xs font-mono font-bold flex items-center gap-1.5 animate-fadeIn">
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
        )}
      </div>

      {/* Resource Allocation Top Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/90 space-y-1">
          <div className="text-xs font-mono text-slate-400 uppercase flex items-center justify-between">
            <span>Total Field Crew</span>
            <Users className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-white">{totalFieldCrew}</span>
            <span className="text-xs text-slate-400 font-mono">personnel</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/90 space-y-1">
          <div className="text-xs font-mono text-slate-400 uppercase flex items-center justify-between">
            <span>Crew Deployment</span>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-emerald-400">{onDutyCount}</span>
            <span className="text-xs text-slate-500 font-mono">/ {totalFieldCrew}</span>
            <span className="text-xs text-slate-400 font-mono ml-auto">
              ({availableCount} standby)
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/90 space-y-1">
          <div className="text-xs font-mono text-slate-400 uppercase flex items-center justify-between">
            <span>Licensed Climbers</span>
            <Award className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-cyan-400">{certifiedClimbersCount}</span>
            <span className="text-xs text-slate-400 font-mono">certified</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/90 space-y-1">
          <div className="text-xs font-mono text-slate-400 uppercase flex items-center justify-between">
            <span>Unassigned Orders</span>
            <AlertTriangle className={`w-3.5 h-3.5 ${pendingOrdersWithoutCrew > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-xl font-bold font-mono ${
                pendingOrdersWithoutCrew > 0 ? 'text-amber-400' : 'text-slate-300'
              }`}
            >
              {pendingOrdersWithoutCrew}
            </span>
            <span className="text-xs text-slate-400 font-mono">need crew</span>
          </div>
        </div>
      </div>

      {/* Main Two-Column Workflow: Pending Work Orders vs. Skill-Based Crew Matcher */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-1">
        {/* Left Column: Work Order Dispatch Selector (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold font-mono text-slate-300 uppercase flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-cyan-400" />
              <span>Select Work Order to Match</span>
            </h3>
            {onNavigateToJobs && (
              <button
                onClick={onNavigateToJobs}
                className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
              >
                <span>View All Jobs</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
            {workOrders.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 text-center text-slate-400 space-y-1">
                <p className="text-xs">No active work orders found.</p>
                <p className="text-xs text-slate-500">
                  Upload a TSSR dossier to generate scheduled rigging work orders.
                </p>
              </div>
            ) : (
              workOrders.map((wo) => {
                const isSelected = wo.id === selectedWoId;
                const assignedCrewMembers = allUsers.filter((u) => wo.assigneeIds.includes(u.id));
                const targetSite = sites.find((s) => s.id === wo.siteId);

                return (
                  <div
                    key={wo.id}
                    onClick={() => setSelectedWoId(wo.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer select-none space-y-2 ${
                      isSelected
                        ? 'bg-blue-950/40 border-blue-500 shadow-md ring-1 ring-blue-500/30'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-cyan-400">
                          {wo.workOrderNumber}
                        </span>
                        <span className="text-xs font-mono text-slate-400">·</span>
                        <span className="text-xs font-mono text-slate-300 font-semibold">
                          {wo.type}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-mono px-1.5 py-0.5 rounded font-bold ${
                          wo.status === 'IN_PROGRESS'
                            ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                            : wo.status === 'APPROVED'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-slate-900 text-slate-400'
                        }`}
                      >
                        {wo.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 flex items-center justify-between">
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                        <strong className="text-slate-200">Site {wo.siteRole}: {wo.siteId}</strong>
                        {targetSite && <span className="truncate">({targetSite.name})</span>}
                      </span>
                      <span className="font-mono text-xs text-slate-500">
                        {wo.scheduledDate}
                      </span>
                    </div>

                    {/* Assigned Crew Avatars / Names */}
                    <div className="pt-1.5 border-t border-slate-850 flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-500">
                        Assigned ({assignedCrewMembers.length}):
                      </span>
                      {assignedCrewMembers.length > 0 ? (
                        <div className="flex items-center gap-1 text-slate-200 font-semibold truncate max-w-[180px]">
                          {assignedCrewMembers.map((m) => m.name.split(' ')[0]).join(', ')}
                        </div>
                      ) : (
                        <span className="text-amber-400 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>No crew assigned</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Intelligent Skill-Based Candidate Matcher (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          {/* Active Job Profile Banner */}
          {selectedWorkOrder && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-blue-400 font-bold uppercase tracking-wider">
                      Matching Work Order:
                    </span>
                    <strong className="text-xs text-white font-mono">
                      {selectedWorkOrder.workOrderNumber}
                    </strong>
                  </div>
                  <h4 className="text-xs font-bold text-slate-200 mt-0.5">
                    {requiredSkills.title}
                  </h4>
                </div>

                <button
                  onClick={handleAutoAssignOptimalCrew}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold text-xs flex items-center gap-1.5 shadow transition-all shrink-0 active:scale-95"
                  title="Auto-match and assign the top compatible crew members"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auto-Match Top Crew</span>
                </button>
              </div>

              {/* Required vs Recommended Skills Badges */}
              <div className="pt-2 border-t border-slate-850 flex flex-wrap items-center gap-1 text-xs font-mono">
                <span className="text-slate-500 font-bold mr-1">Mandatory:</span>
                {requiredSkills.mandatoryCerts.map((cert) => (
                  <span
                    key={cert}
                    className="px-1.5 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800 font-medium"
                  >
                    {cert}
                  </span>
                ))}
                {requiredSkills.requiresClimberLicense && (
                  <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-medium">
                    Climber License Required
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search crew by name, specialization, or certification..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
              {(['ALL', 'TOWER_CLIMBER', 'TECHNICIAN', 'TEAM_LEADER'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-2 py-1 rounded text-xs font-mono transition-colors whitespace-nowrap ${
                    roleFilter === r
                      ? 'bg-cyan-600 text-white font-bold'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {r === 'TOWER_CLIMBER' ? 'Climbers' : r === 'TEAM_LEADER' ? 'Leaders' : r}
                </button>
              ))}

              <button
                onClick={() =>
                  setAvailabilityFilter((prev) =>
                    prev === 'ALL' ? 'AVAILABLE' : prev === 'AVAILABLE' ? 'ON_DUTY' : 'ALL'
                  )
                }
                className={`px-2 py-1 rounded text-xs font-mono border transition-colors whitespace-nowrap ${
                  availabilityFilter !== 'ALL'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700 font-bold'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
                title="Filter by availability status"
              >
                {availabilityFilter === 'ALL'
                  ? 'All Status'
                  : availabilityFilter === 'AVAILABLE'
                  ? 'Standby Only'
                  : 'On Duty'}
              </button>
            </div>
          </div>

          {/* Candidate Cards Grid */}
          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {filteredCrew.length === 0 ? (
              <div className="p-8 rounded-xl bg-slate-950 border border-slate-800 text-center text-slate-500 space-y-1">
                <p className="text-xs">No crew members match the selected filter.</p>
                <p className="text-xs">Try resetting search or role filter.</p>
              </div>
            ) : (
              filteredCrew.map(
                ({ crew, score, matchedMandatory, missingMandatory, isAssigned, activeWorkload }) => {
                  const isHighAltitudeCertified = Boolean(crew.climberLicenseNo);

                  return (
                    <div
                      key={crew.id}
                      className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isAssigned
                          ? 'bg-emerald-950/20 border-emerald-600/80 ring-1 ring-emerald-500/20'
                          : 'bg-slate-950 border-slate-800/90 hover:border-slate-700'
                      }`}
                    >
                      {/* Left: Candidate Bio & Skills */}
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-white">
                            {crew.name}
                          </span>
                          <span className="text-slate-500 font-mono text-xs">·</span>
                          <span className="text-xs font-mono text-slate-300">
                            {crew.role.replace('_', ' ')}
                          </span>
                          {crew.yearsExperience && (
                            <>
                              <span className="text-slate-500 font-mono text-xs">·</span>
                              <span className="text-xs font-mono text-slate-400">
                                {crew.yearsExperience} yrs exp
                              </span>
                            </>
                          )}
                          <span
                            className={`text-xs font-mono px-1.5 py-0.5 rounded font-bold ${
                              crew.status === 'AVAILABLE'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-slate-900 text-slate-400 border border-slate-800'
                            }`}
                          >
                            {crew.status === 'AVAILABLE' ? 'Standby' : 'On Duty'}
                          </span>
                        </div>

                        {crew.specialization && (
                          <p className="text-xs text-slate-400 truncate">
                            {crew.specialization}
                          </p>
                        )}

                        {/* Matched vs Missing Certifications Breakdown */}
                        <div className="flex items-center gap-1.5 flex-wrap text-xs font-mono pt-0.5">
                          {matchedMandatory.map((cert) => (
                            <span
                              key={cert}
                              className="px-1.5 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-800 flex items-center gap-1"
                            >
                              <Check className="w-2.5 h-2.5 text-emerald-400" />
                              <span>{cert}</span>
                            </span>
                          ))}

                          {missingMandatory.map((cert) => (
                            <span
                              key={cert}
                              className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-500 border border-slate-800 line-through"
                              title={`Missing mandatory: ${cert}`}
                            >
                              {cert}
                            </span>
                          ))}

                          {isHighAltitudeCertified && (
                            <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800 flex items-center gap-1">
                              <ShieldCheck className="w-2.5 h-2.5 text-cyan-400" />
                              <span>Lic: {crew.climberLicenseNo}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Compatibility Score & Assign Button */}
                      <div className="flex items-center gap-3 shrink-0 justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-850">
                        {/* Score Indicator */}
                        <div className="text-right font-mono">
                          <div className="flex items-center gap-1">
                            <span
                              className={`text-sm font-bold ${
                                score >= 85
                                  ? 'text-emerald-400'
                                  : score >= 60
                                  ? 'text-cyan-400'
                                  : 'text-amber-400'
                              }`}
                            >
                              {score}%
                            </span>
                            <span className="text-xs text-slate-500">match</span>
                          </div>
                          <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                            <div
                              className={`h-full rounded-full transition-all ${
                                score >= 85
                                  ? 'bg-emerald-400'
                                  : score >= 60
                                  ? 'bg-cyan-400'
                                  : 'bg-amber-400'
                              }`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                        </div>

                        {/* Interactive Assign / Unassign Button */}
                        <button
                          onClick={() => handleToggleAssign(crew.id, isAssigned)}
                          className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all flex items-center gap-1.5 shadow ${
                            isAssigned
                              ? 'bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-300'
                              : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                          }`}
                        >
                          {isAssigned ? (
                            <>
                              <UserMinus className="w-3.5 h-3.5" />
                              <span>Assigned (Remove)</span>
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>Assign Crew</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                }
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
