import React, { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  X,
  UserCheck,
  Lock,
  HardHat,
  Wind,
  Radio,
  Zap,
} from 'lucide-react';
import { WorkOrder, Site, UserProfile } from '../../types/fieldops';
import { WeatherForecastWidget } from '../weather/WeatherForecastWidget';

interface PreClimbSafetyModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder: WorkOrder;
  site: Site;
  activeUser: UserProfile;
  onStartJobConfirmed: (safetyData: {
    ppeItems: string[];
    hazardItems: string[];
    notes: string;
    signature: string;
  }) => void;
  sunlightMode: boolean;
}

export const PreClimbSafetyModal: React.FC<PreClimbSafetyModalProps> = ({
  isOpen,
  onClose,
  workOrder,
  site,
  activeUser,
  onStartJobConfirmed,
  sunlightMode,
}) => {
  // PPE checklist state
  const [ppe, setPpe] = useState({
    harness: true,
    doubleLanyard: true,
    helmet: true,
    steelBoots: true,
    hiVisVest: true,
    safetyGlasses: true,
  });

  // Site hazards checklist state
  const [hazards, setHazards] = useState({
    rfRadiationVerified: true,
    lotoRectifierIsolated: true,
    weatherWindSafe: true,
    buddySystemBriefed: true,
    structuralLegChecked: true,
  });

  const [notes, setNotes] = useState<string>('');
  const [signature, setSignature] = useState<string>(activeUser.name || '');

  if (!isOpen) return null;

  const allPpeChecked = Object.values(ppe).every(Boolean);
  const allHazardsAcknowledged = Object.values(hazards).every(Boolean);
  const canStart = allPpeChecked && allHazardsAcknowledged && signature.trim().length > 0;

  const handleConfirm = () => {
    if (!canStart) return;
    const ppeItems = Object.entries(ppe)
      .filter(([_, v]) => v)
      .map(([k]) => k);
    const hazardItems = Object.entries(hazards)
      .filter(([_, v]) => v)
      .map(([k]) => k);

    onStartJobConfirmed({
      ppeItems,
      hazardItems,
      notes,
      signature,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div
        className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
          sunlightMode
            ? 'bg-amber-50 border-amber-300 text-neutral-900'
            : 'bg-slate-900 border-slate-700 text-slate-100'
        }`}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-700/80 flex items-center justify-between bg-gradient-to-r from-amber-600/20 to-rose-600/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Mandatory Pre-Climb Safety Gate
              </h2>
              <p className="text-xs text-slate-300 font-mono">
                Work Order: {workOrder.workOrderNumber} · Site {workOrder.siteRole}: {site.id} ({site.name})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Warning Banner */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold text-amber-300 uppercase font-mono">
                Zero-Tolerance Tower Safety Compliance
              </strong>
              Before initiating work order execution or tower ascent on Site {workOrder.siteRole} ({site.tower.type || 'SST Tower'}, {site.tower.heightM || 45}m), you must verify and log PPE equipment compliance and site-specific RF/electrical hazard mitigations.
            </div>
          </div>

          {/* Localized Weather Forecast & Tower Safety Gate */}
          <WeatherForecastWidget
            compact={true}
            sunlightMode={sunlightMode}
            siteCoords={{
              lat: site.lat,
              lon: site.long,
              name: `Site ${workOrder.siteRole}: ${site.id} (${site.name})`,
            }}
          />

          {/* Section 1: PPE Equipment Verification */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-mono font-bold uppercase text-cyan-400 flex items-center gap-2">
                <HardHat className="w-4 h-4" />
                1. Personal Protective Equipment (PPE) Checklist
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {Object.values(ppe).filter(Boolean).length}/6 Verified
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                { key: 'harness', label: 'Full-Body Harness (ANSI Z359 / EN 361 inspected)' },
                { key: 'doubleLanyard', label: 'Double Lanyard with Shock Absorber' },
                { key: 'helmet', label: 'Safety Helmet with Chin Strap' },
                { key: 'steelBoots', label: 'Steel-Toed Boots (Slip-Resistant)' },
                { key: 'hiVisVest', label: 'High-Visibility Reflective Vest / Suit' },
                { key: 'safetyGlasses', label: 'Safety Glasses & Rigging Gloves' },
              ].map((item) => {
                const checked = (ppe as any)[item.key];
                return (
                  <label
                    key={item.key}
                    className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                      checked
                        ? 'bg-cyan-950/40 border-cyan-600/80 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setPpe((prev) => ({ ...prev, [item.key]: e.target.checked }))
                      }
                      className="w-4 h-4 rounded border-slate-700 text-cyan-600 focus:ring-cyan-500 bg-slate-900"
                    />
                    <span className="text-xs font-medium">{item.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Section 2: Site-Specific Hazards & RF/Electrical Safety */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-mono font-bold uppercase text-amber-400 flex items-center gap-2">
                <Radio className="w-4 h-4" />
                2. Site Hazards & Environmental Mitigation
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {Object.values(hazards).filter(Boolean).length}/5 Acknowledged
              </span>
            </div>

            <div className="space-y-2">
              {[
                {
                  key: 'rfRadiationVerified',
                  label: 'RF Radiation Warning: Microwave 11GHz Sector Shutdown / Safe Distance Verified',
                  icon: Radio,
                },
                {
                  key: 'lotoRectifierIsolated',
                  label: '-48V DC Power Rectifiers & MCB Breakers Lockout/Tagout (LOTO) Confirmed',
                  icon: Zap,
                },
                {
                  key: 'weatherWindSafe',
                  label: 'Wind Speed & Atmospheric Conditions Verified (<35 knots, No Lightning)',
                  icon: Wind,
                },
                {
                  key: 'structuralLegChecked',
                  label: 'Tower Leg C / Grounding Busbar & Climb Path Structural Inspection OK',
                  icon: ShieldAlert,
                },
                {
                  key: 'buddySystemBriefed',
                  label: 'Ground Support Buddy & Emergency Rescue Plan Briefed with Supervisor',
                  icon: UserCheck,
                },
              ].map((item) => {
                const checked = (hazards as any)[item.key];
                const IconComponent = item.icon;
                return (
                  <label
                    key={item.key}
                    className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                      checked
                        ? 'bg-amber-950/30 border-amber-600/70 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setHazards((prev) => ({ ...prev, [item.key]: e.target.checked }))
                      }
                      className="w-4 h-4 rounded border-slate-700 text-amber-600 focus:ring-amber-500 bg-slate-900"
                    />
                    <IconComponent className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Section 3: Climber Sign-off & Remarks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-mono font-bold text-slate-300 mb-1">
                Lead Climber / Technician Name & License No. *
              </label>
              <input
                type="text"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="e.g. Engr. Juan Dela Cruz (Cert #9821)"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-mono font-bold text-slate-300 mb-1">
                Site Hazards & Weather Notes (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Gusty winds at 15 knots, grounding bus verified on leg C"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono">
            {canStart ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Safety Gate Satisfied · Ready to Start Job
              </span>
            ) : (
              <span className="text-amber-400">Complete all PPE & Hazard checklists to enable Start</span>
            )}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canStart}
              onClick={handleConfirm}
              className={`px-5 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all shadow-lg ${
                canStart
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-emerald-950/50'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Confirm Safety Check & Start Job</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
