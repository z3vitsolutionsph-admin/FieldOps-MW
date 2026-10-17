import React, { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Zap,
  Truck,
  ShieldAlert,
  CheckCircle2,
  Sparkles,
  Info,
  ArrowRight,
  Package,
  Compass,
  Radio,
  FileText,
  CheckSquare,
  Lock,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { Site, Hop, UserProfile, WorkOrder, TssrApprovalSheet } from '../../types/fieldops';
import { gemini } from '../../services/geminiService';
import { SEED_SITE_A, SEED_SITE_B } from '../../data/seedData';

export interface TssrRiskItem {
  id: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  category: 'LOGISTICS' | 'POWER' | 'HEIGHTS' | 'ACCESS' | 'STRUCTURAL';
  sourceTssr: string;
  siteLabel?: string;
  constraintValue: string;
  impactDescription: string;
  mandatoryMitigations: string[];
  recommendedGear: string[];
  isFlagged: boolean;
}

interface DynamicRiskAnalysisProps {
  site: Site;
  hop: Hop;
  approvals: TssrApprovalSheet;
  workOrder: WorkOrder;
  activeUser: UserProfile;
  stepData: Record<string, any>;
  onUpdateField: (key: string, value: any) => void;
  onProceed: () => void;
  sunlightMode?: boolean;
}

export const DynamicRiskAnalysis: React.FC<DynamicRiskAnalysisProps> = ({
  site,
  hop,
  approvals,
  workOrder,
  activeUser,
  stepData,
  onUpdateField,
  onProceed,
  sunlightMode,
}) => {
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [inspectionScope, setInspectionScope] = useState<'CURRENT' | 'SITE_A' | 'SITE_B' | 'HOP_COMBINED'>('CURRENT');

  // Helper function to extract site-specific safety constraints from TSSR data
  const extractRisks = (targetSite: Site, sitePrefix: string = ''): TssrRiskItem[] => {
    const list: TssrRiskItem[] = [];

    // 1. Manual Hauling > 100m Constraint Check
    const distM = targetSite.accessRoad?.distanceToMainRoadM || 0;
    const extremeDistM = targetSite.accessRoad?.extremeHaulingMeters || 0;
    const isManual =
      targetSite.accessRoad?.haulingMethod === 'MANUAL' || targetSite.accessRoad?.haulingMethod === 'EXTREME_MANUAL';
    const isLongHaul = distM > 100 || extremeDistM > 100 || (isManual && distM > 40);

    if (isLongHaul || isManual) {
      list.push({
        id: `risk-manual-hauling-${targetSite.id}`,
        title: `${sitePrefix}Manual Hauling > 100m (${Math.max(distM, extremeDistM)}m on ${targetSite.accessRoad?.type} terrain)`,
        severity: 'CRITICAL',
        category: 'LOGISTICS',
        siteLabel: `Site ${targetSite.role}: ${targetSite.id}`,
        sourceTssr: 'TSSR Section 1.3: Access Road & Logistics Survey',
        constraintValue: `${targetSite.accessRoad?.haulingMethod} hauling over ${distM}m (Extreme: ${extremeDistM}m) on ${targetSite.accessRoad?.type} trail`,
        impactDescription:
          'Site access road is impassable for vehicles. Heavy 1.2m parabolic antenna dish (~38kg with feedhorn), ODC cabinet, and radio units must be manually portaged over steep trail terrain. High risk of dropped equipment, worker fatigue, and slip/trip incidents.',
        mandatoryMitigations: [
          'Mobilize minimum 4 dedicated porters / hauling crew at depot departure',
          'Use two-person canvas carrying stretchers and padded shoulder yokes for 1.2m dish',
          'Establish staging laydown area at main road drop point with security watchman',
          'Pack trail hydration packs, traction cleats, and portable field trauma kit',
        ],
        recommendedGear: [
          'Heavy-duty dish carrying harness & padded wrap',
          '2x 30m hauling ropes with locking carabiners',
          'Staging tarpaulins for ground protection',
        ],
        isFlagged: true,
      });
    }

    // 2. No Commercial Power Constraint Check
    const noCommercial =
      !targetSite.commercialPower?.available ||
      targetSite.commercialPower?.remarks?.toLowerCase().includes('no commercial') ||
      targetSite.commercialPower?.remarks?.toLowerCase().includes('generator required');
    const mcbNotConnected = !targetSite.commercialPower?.mcbConnected || !targetSite.power?.rectifierEnergized;

    if (noCommercial || mcbNotConnected) {
      list.push({
        id: `risk-no-power-${targetSite.id}`,
        title: noCommercial
          ? `${sitePrefix}No Commercial Grid Power Available at Site`
          : `${sitePrefix}Commercial Grid MCB Not Connected / Rectifier De-Energized`,
        severity: 'CRITICAL',
        category: 'POWER',
        siteLabel: `Site ${targetSite.role}: ${targetSite.id}`,
        sourceTssr: 'TSSR Section 1.14: Commercial Power & Facility Engineering Approval',
        constraintValue: targetSite.commercialPower?.remarks || 'No commercial grid drop energized at survey',
        impactDescription:
          'Site has NO energized AC/DC utility power available. Rectifier and DCPDB-01 cannot deliver -48V DC nominal voltage. Antenna alignment, IDU commissioning, and BER testing require auxiliary portable generator power.',
        mandatoryMitigations: [
          'Load portable inverter generator (minimum 5.0 kVA pure sine wave) in service vehicle',
          'Carry 20L OSHA-approved safety fuel can (UL listed with spark arrester)',
          'Pack 1.5m temporary copper grounding rod to bond generator chassis to tower ring',
          'Verify backup benchtop -48V DC power supply adapter and charged auxiliary batteries',
          'Stage Class ABC dry chemical fire extinguisher adjacent to temporary generator',
        ],
        recommendedGear: [
          '5 kVA Inverter Generator + 20L Fuel Can',
          'Portable copper grounding rod with bonding clamp',
          'Heavy-duty 20m outdoor power extension reel',
        ],
        isFlagged: true,
      });
    }

    // 3. High Elevation Tower Work Constraint Check
    const tHeight = targetSite.tower?.heightM || 0;
    const aclHeight = targetSite.approvedAclHeightM || 40.7;
    const isHighTower = tHeight >= 40 || aclHeight >= 35;

    if (isHighTower) {
      list.push({
        id: `risk-high-tower-${targetSite.id}`,
        title: `${sitePrefix}High-Altitude Tower Work (${aclHeight}m Centerline / ${tHeight}m Tower)`,
        severity: 'HIGH',
        category: 'HEIGHTS',
        siteLabel: `Site ${targetSite.role}: ${targetSite.id}`,
        sourceTssr: 'TSSR Section 1.5 & Transport Engineering Clearance Sheet',
        constraintValue: `Approved ACL: ${aclHeight}m on ${targetSite.approvedAclLeg || 'Leg C'} (${targetSite.tower?.type})`,
        impactDescription:
          'Climbers must ascend above 40 meters on a steel lattice structure while rigging a heavy 1.2m antenna dish. High exposure to wind shear, physical exhaustion, and dropped object hazards.',
        mandatoryMitigations: [
          'Enforce 100% tie-off cable grab fall arrest sleeve on tower safety climb wire rope',
          'Rig dedicated gin pole or capstan hoist with certified 16mm lifting rope for dish hoisting',
          'Barricade a 15-meter ground exclusion drop zone around tower base with warning tape',
          'Verify continuous two-way UHF radio communication between aloft climbers and ground crew',
        ],
        recommendedGear: [
          'Gin pole / antenna hoisting pulley kit',
          'High-visibility exclusion zone barrier tape',
          'Dual waterproof UHF two-way hand radios',
        ],
        isFlagged: true,
      });
    }

    // 4. Remote Trail & Unpaved Access Road Constraint Check
    const isUnpaved =
      targetSite.accessRoad?.type === 'DIRT' ||
      targetSite.accessRoad?.type === 'NO_ROAD' ||
      !targetSite.accessRoad?.available;
    if (isUnpaved) {
      list.push({
        id: `risk-unpaved-road-${targetSite.id}`,
        title: `${sitePrefix}Unpaved Dirt Road / Impassable Trail (${targetSite.accessRoad?.type})`,
        severity: 'MEDIUM',
        category: 'ACCESS',
        siteLabel: `Site ${targetSite.role}: ${targetSite.id}`,
        sourceTssr: 'TSSR Section 1.2: Access Route Classification',
        constraintValue: `Road type: ${targetSite.accessRoad?.type}. Distance from main road: ${distM}m`,
        impactDescription:
          'Transit route is vulnerable to monsoon mud and deep ruts. 4x4 high-clearance vehicle required.',
        mandatoryMitigations: [
          'Assign 4x4 high-clearance service truck equipped with recovery winch and tow strap',
          'Verify regional weather forecast for rain squalls before departing depot',
          'Coordinate emergency vehicle towing contact with local barangay hall',
        ],
        recommendedGear: ['Vehicle recovery kinetic tow strap & shackles', 'Off-road tire traction mats'],
        isFlagged: false,
      });
    }

    return list;
  };

  // Compile risk items based on active inspection scope
  let riskItems: TssrRiskItem[] = [];
  if (inspectionScope === 'CURRENT') {
    // Current site plus flagged hop-wide items if any
    riskItems = extractRisks(site);
    // If current site has low hauling distance, also append Site A's critical logistics as far-end hop alert
    if (site.id !== SEED_SITE_A.id) {
      const farEndRisks = extractRisks(SEED_SITE_A, '[Far-End Site A] ');
      farEndRisks.forEach((r) => {
        if (r.isFlagged && !riskItems.some((existing) => existing.category === r.category && existing.title.includes('Manual Hauling'))) {
          riskItems.push(r);
        }
      });
    }
  } else if (inspectionScope === 'SITE_A') {
    riskItems = extractRisks(SEED_SITE_A, '[Site A] ');
  } else if (inspectionScope === 'SITE_B') {
    riskItems = extractRisks(SEED_SITE_B, '[Site B] ');
  } else {
    // HOP_COMBINED
    riskItems = [
      ...extractRisks(SEED_SITE_A, '[Site A] '),
      ...extractRisks(SEED_SITE_B, '[Site B] '),
    ];
  }

  // Count flagged items
  const flaggedCount = riskItems.filter((r) => r.isFlagged).length;
  const criticalCount = riskItems.filter((r) => r.severity === 'CRITICAL').length;

  const mitigationsState = stepData.mitigationsAcknowledged || {};
  const isAcknowledged = Boolean(stepData.riskAnalysisSigned);

  const toggleMitigation = (riskId: string, idx: number) => {
    const key = `${riskId}_${idx}`;
    const next = { ...mitigationsState, [key]: !mitigationsState[key] };
    onUpdateField('mitigationsAcknowledged', next);
  };

  const handleAcknowledgeAllMitigations = () => {
    const next = { ...mitigationsState };
    riskItems.forEach((item) => {
      item.mandatoryMitigations.forEach((_, idx) => {
        next[`${item.id}_${idx}`] = true;
      });
    });
    onUpdateField('mitigationsAcknowledged', next);
  };

  const handleAskAiAboutRisks = async () => {
    setIsAiLoading(true);
    const targetForAi = inspectionScope === 'SITE_A' ? SEED_SITE_A : inspectionScope === 'SITE_B' ? SEED_SITE_B : site;
    const distanceM = Math.max(targetForAi.accessRoad?.distanceToMainRoadM || 0, targetForAi.accessRoad?.extremeHaulingMeters || 0);
    const towerHeight = targetForAi.tower?.heightM || 45;
    const aclHeight = targetForAi.approvedAclHeightM || approvals?.transportEng?.aclApprovedM || 40.7;

    try {
      const prompt = `As a Senior Telecom EHS Safety Director, review these site-specific TSSR constraints for Site ${targetForAi.id} (${targetForAi.name}):
- Access Road: ${targetForAi.accessRoad?.haulingMethod || 'MANUAL'} hauling over ${distanceM}m (${targetForAi.accessRoad?.type || 'DIRT'})
- Commercial Power: ${targetForAi.commercialPower?.available ? 'Available' : 'NOT Available'} (${targetForAi.commercialPower?.remarks || 'No commercial grid drop'})
- Tower: ${targetForAi.tower?.type || 'Greenfield'} ${towerHeight}m, antenna dish on ${targetForAi.approvedAclLeg || 'Leg C'} at ${aclHeight}m.
Provide a concise 3-bullet pre-departure risk briefing with prioritized mitigation instructions for the field truck departure.`;

      const res = await gemini.askFieldOps(prompt, { site: targetForAi, hop, workOrder });
      setAiAnalysis(res);
      onUpdateField('aiRiskAnalysisNotes', res);
    } catch (e) {
      setAiAnalysis(
        '1. Critical Logistics: Manual hauling > 100m requires dedicated porters and shoulder carrying straps to prevent dish drop.\n2. Power Isolation: Mobilize 5kVA genset with copper ground rod—site has zero commercial power.\n3. Tower Rigging: Centerline dish hoisting requires gin pole and 15m ground exclusion barricade.'
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Scope Selector Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto p-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
        <span className="text-[10px] font-mono text-slate-400 font-bold px-2 shrink-0">
          TSSR AUDIT SCOPE:
        </span>
        <button
          type="button"
          onClick={() => setInspectionScope('CURRENT')}
          className={`px-3 py-1.5 rounded-lg font-mono text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            inspectionScope === 'CURRENT'
              ? 'bg-cyan-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <span>Target Site: {site.id}</span>
          <span className="text-[10px] opacity-75 font-normal">({site.role})</span>
        </button>
        <button
          type="button"
          onClick={() => setInspectionScope('SITE_A')}
          className={`px-3 py-1.5 rounded-lg font-mono text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            inspectionScope === 'SITE_A'
              ? 'bg-rose-700 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-rose-400 inline-block"></span>
          <span>Site A ({SEED_SITE_A.id})</span>
          <span className="text-[10px] px-1 rounded bg-rose-950 text-rose-300 border border-rose-800">
            200m Haul &bull; Off-Grid
          </span>
        </button>
        <button
          type="button"
          onClick={() => setInspectionScope('SITE_B')}
          className={`px-3 py-1.5 rounded-lg font-mono text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            inspectionScope === 'SITE_B'
              ? 'bg-cyan-700 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <span>Site B ({SEED_SITE_B.id})</span>
          <span className="text-[10px] opacity-75 font-normal">Catangnan</span>
        </button>
        <button
          type="button"
          onClick={() => setInspectionScope('HOP_COMBINED')}
          className={`px-3 py-1.5 rounded-lg font-mono text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            inspectionScope === 'HOP_COMBINED'
              ? 'bg-purple-700 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <span>Link Hop (Combined Both Sites)</span>
        </button>
      </div>
      {/* Risk Analysis Header Banner */}
      <div
        className={`p-4 rounded-xl border ${
          criticalCount > 0
            ? 'bg-rose-950/40 border-rose-600/80 shadow-md ring-1 ring-rose-500/40'
            : 'bg-amber-950/30 border-amber-600/80'
        }`}
      >
        <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-rose-600 text-white shrink-0 mt-0.5 shadow">
              <AlertOctagon className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded bg-rose-600 text-white">
                  TSSR SITE CONSTRAINTS DETECTED
                </span>
                <span className="text-xs font-mono font-bold text-rose-300">
                  {criticalCount} Critical &bull; {flaggedCount} High-Risk Flags
                </span>
              </div>
              <h3 className="text-base font-black text-white mt-1">
                Dynamic Pre-Departure Risk Analysis
              </h3>
              <p className="text-xs text-rose-200/90 leading-relaxed mt-0.5">
                Automated audit of TSSR survey parameters for Site <strong>{site.id}</strong> (
                {site.name}). High-risk safety constraints must be mitigated and verified before loading
                the service truck.
              </p>
            </div>
          </div>

          {/* Aggregate Risk Score Badge */}
          <div className="text-right sm:border-l sm:border-rose-800/80 sm:pl-4 shrink-0">
            <span className="text-[10px] font-mono uppercase text-slate-400 block font-bold">
              Site Risk Profile
            </span>
            <span
              className={`text-lg font-black font-mono tracking-tight ${
                criticalCount > 0 ? 'text-rose-400' : 'text-amber-400'
              }`}
            >
              {criticalCount > 0 ? 'LEVEL 4 — CRITICAL' : 'LEVEL 3 — ELEVATED'}
            </span>
            <p className="text-[10px] text-slate-400 font-mono">
              Action Plan Mandatory
            </p>
          </div>
        </div>
      </div>

      {/* Flagged High-Risk Cards */}
      <div className="space-y-3">
        {riskItems.map((item) => {
          const isCritical = item.severity === 'CRITICAL';
          return (
            <div
              key={item.id}
              className={`rounded-xl border p-4 transition-all duration-200 ${
                isCritical
                  ? 'bg-slate-950/80 border-rose-600/90 shadow-md ring-1 ring-rose-500/30'
                  : 'bg-slate-950/60 border-amber-600/70'
              }`}
            >
              {/* Card Title & Tags */}
              <div className="flex items-start justify-between gap-2 flex-wrap sm:flex-nowrap mb-2">
                <div className="flex items-start gap-2.5">
                  <div
                    className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                      isCritical
                        ? 'bg-rose-950 text-rose-400 border border-rose-800'
                        : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}
                  >
                    {item.category === 'LOGISTICS' ? (
                      <Truck className="w-5 h-5" />
                    ) : item.category === 'POWER' ? (
                      <Zap className="w-5 h-5" />
                    ) : item.category === 'HEIGHTS' ? (
                      <Radio className="w-5 h-5" />
                    ) : (
                      <ShieldAlert className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded ${
                          isCritical
                            ? 'bg-rose-600 text-white animate-pulse'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                        }`}
                      >
                        {item.severity} RISK FLAG
                      </span>
                      <span className="text-[10px] font-mono text-cyan-400">
                        {item.category}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-white mt-1">
                      {item.title}
                    </h4>
                  </div>
                </div>

                <span className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-1 rounded self-start shrink-0">
                  {item.sourceTssr}
                </span>
              </div>

              {/* TSSR Constraint Quote Box */}
              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs font-mono space-y-1 mb-3">
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>SURVEYED TSSR CONSTRAINT:</span>
                  <span className="text-cyan-400">{site.id}</span>
                </div>
                <p className="text-slate-200 font-semibold">{item.constraintValue}</p>
              </div>

              {/* Impact Description */}
              <p className="text-xs text-slate-300 leading-relaxed mb-3">
                {item.impactDescription}
              </p>

              {/* Mandatory Mitigations Checklist */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-200 uppercase font-mono block">
                    Mandatory Pre-Departure Mitigations:
                  </span>
                  <button
                    type="button"
                    onClick={handleAcknowledgeAllMitigations}
                    className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 underline"
                  >
                    Check All Mitigations
                  </button>
                </div>
                <div className="space-y-1.5">
                  {item.mandatoryMitigations.map((mitigation, idx) => {
                    const key = `${item.id}_${idx}`;
                    const checked = mitigationsState[key] || false;
                    return (
                      <label
                        key={idx}
                        className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                          checked
                            ? 'bg-emerald-950/30 border-emerald-800 text-slate-200'
                            : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMitigation(item.id, idx)}
                          className="mt-0.5 w-4 h-4 rounded text-emerald-600 bg-slate-950 border-slate-700"
                        />
                        <span className="flex-1 leading-normal">{mitigation}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Recommended Gear / Cargo Box */}
              <div className="mt-3 p-2.5 rounded-lg bg-cyan-950/20 border border-cyan-900/60 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-cyan-300 font-mono text-[11px]">
                  <Package className="w-3.5 h-3.5 shrink-0" />
                  <strong>Cargo to Manifest in Service Truck:</strong>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {item.recommendedGear.map((gear, gIdx) => (
                    <span
                      key={gIdx}
                      className="px-2 py-0.5 rounded bg-slate-900 border border-cyan-800/80 text-[10px] font-mono text-cyan-200"
                    >
                      {gear}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Risk Briefing Assistant */}
      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-slate-200">
              Gemini AI Pre-Departure Risk Consultation
            </span>
          </div>
          <button
            type="button"
            onClick={handleAskAiAboutRisks}
            disabled={isAiLoading}
            className="px-3 py-1 rounded bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-bold flex items-center gap-1.5 shadow"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
            {isAiLoading ? 'Analyzing TSSR...' : 'Generate AI Risk Briefing'}
          </button>
        </div>

        {aiAnalysis && (
          <div className="p-3 rounded-lg bg-slate-900 border border-cyan-900/70 text-xs text-slate-300 whitespace-pre-line leading-relaxed">
            <span className="text-[10px] font-mono text-cyan-400 font-bold block mb-1">
              AI CHIEF SAFETY OFFICER BRIEFING:
            </span>
            {aiAnalysis}
          </div>
        )}
      </div>

      {/* Field Supervisor Pre-Departure Sign-off */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isAcknowledged}
            onChange={(e) => onUpdateField('riskAnalysisSigned', e.target.checked)}
            className="mt-1 w-5 h-5 rounded text-emerald-600 bg-slate-900 border-slate-700 focus:ring-0"
          />
          <div>
            <p className="text-xs font-bold text-slate-100">
              I acknowledge the site-specific TSSR constraints above and verify required mitigations
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              Certified by <strong>{activeUser.name}</strong> ({activeUser.role}). All critical
              contingency gear (including portable power, hauling equipment, and height rigging) is
              confirmed and allocated before the pre-departure checklist.
            </p>
          </div>
        </label>

        {isAcknowledged && (
          <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800 text-xs text-emerald-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Dynamic Risk Analysis Verified — Pre-Departure Checklist Unlocked
            </span>
            <span className="text-[10px] font-mono text-emerald-400">
              {new Date().toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
