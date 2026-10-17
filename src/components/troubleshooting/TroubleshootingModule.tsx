import React, { useState } from 'react';
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Clock,
  ArrowRight,
  Activity,
  Zap,
  Radio,
  FileCheck2,
  RotateCcw,
  PlusCircle,
  Battery,
  TrendingDown,
  BarChart2,
  Layers,
} from 'lucide-react';
import { TroubleshootingTicket, Site, Hop, UserProfile } from '../../types/fieldops';
import { storage } from '../../services/storageService';
import { BatteryDischargeChart } from './BatteryDischargeChart';

interface TroubleshootingProps {
  site: Site;
  hop: Hop;
  activeUser: UserProfile;
  tickets: TroubleshootingTicket[];
  sunlightMode: boolean;
}

export const TroubleshootingModule: React.FC<TroubleshootingProps> = ({
  site,
  hop,
  activeUser,
  tickets,
  sunlightMode,
}) => {
  const [activeTab, setActiveTab] = useState<'DECISION_TREE' | 'BATTERY_CHART' | 'TICKETS'>('DECISION_TREE');

  const [selectedSymptom, setSelectedSymptom] = useState<
    'LOW_RSL' | 'LINK_DOWN' | 'HIGH_BER' | 'FLAPPING' | 'POWER_FAILURE' | 'XPIC_DEGRADED'
  >('LOW_RSL');

  const [activeStep, setActiveStep] = useState<number>(0);
  const [measurements, setMeasurements] = useState<{
    measuredRslDbm?: number;
    voltageDc?: number;
    berValue?: string;
    temperatureC?: number;
  }>({
    measuredRslDbm: -38.5,
    voltageDc: -48.2,
    berValue: '1.4E-5',
    temperatureC: 38,
  });

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [rootCause, setRootCause] = useState<string>('');
  const [actionTaken, setActionTaken] = useState<string>('');
  const [resolutionOutcome, setResolutionOutcome] = useState<
    'RESOLVED' | 'ESCALATED_NOC' | 'ESCALATED_VENDOR' | 'SPARE_REQUIRED'
  >('RESOLVED');

  // Decision Tree Steps based on Symptom
  const getDecisionSteps = () => {
    switch (selectedSymptom) {
      case 'LOW_RSL':
        return [
          {
            id: 'rf_variance',
            question: `Compare Measured RSL against TSSR Expected (${hop.expectedRslDbm} dBm). What is the variance?`,
            options: [
              { label: 'Within ±3.0 dB (Acceptable)', next: 'check_mod' },
              { label: '3 dB to 10 dB Deficit (Minor Misalignment or Rain Fade)', next: 'check_weather' },
              { label: '>10 dB Deficit (Severe Misalignment or Feedhorn Damage)', next: 'check_panning' },
            ],
          },
          {
            id: 'check_weather',
            question: 'Is heavy tropical rain, monsoon fog, or ducting present along Siargao path?',
            options: [
              { label: 'Yes, heavy rain fade active', next: 'rain_wait' },
              { label: 'Clear dry weather', next: 'check_panning' },
            ],
          },
          {
            id: 'check_panning',
            question: 'Inspect AMB mount and panning bracket. Did tower wind shift the antenna azimuth or elevation?',
            options: [
              { label: 'Azimuth shifted by 2°–5°', next: 'realign_dish' },
              { label: 'Azimuth locked on 241°, suspect feeder or ODU', next: 'check_if_feeder' },
            ],
          },
          {
            id: 'check_if_feeder',
            question: 'Inspect IF cable connector and weatherproofing at ODU collar. Any water ingress?',
            options: [
              { label: 'Water ingress detected in N-connector', next: 'replace_connector' },
              { label: 'IF connector is dry and clean', next: 'check_odu_tx' },
            ],
          },
        ];

      case 'POWER_FAILURE':
        return [
          {
            id: 'battery_curve_check',
            question: 'Inspect 24h battery discharge graph below. Did terminal voltage dip below Low Voltage Alarm threshold (-45.0V)?',
            options: [
              { label: 'Yes, voltage dropped to -44.6V during utility outage (Battery Depleted)', next: 'genset_deploy' },
              { label: 'No, voltage is stable at float (-53.5V), but IDU is unpowered', next: 'breaker_check' },
              { label: 'Zero voltage (0V) measured across DC busbar (System Cutoff / Open Circuit)', next: 'lvd_cutoff' },
            ],
          },
          {
            id: 'breaker_check',
            question: 'Inspect DCPDB microwave circuit breaker slot CB-07 (32A). Is breaker tripped or charred?',
            options: [
              { label: 'Breaker tripped to OFF position due to overcurrent', next: 'reset_breaker' },
              { label: 'Breaker is ON, but multimeter reads high resistance or voltage drop', next: 'replace_breaker' },
              { label: 'Breaker is functional, cable terminal loose at RTN 9150 power block', next: 'torque_terminals' },
            ],
          },
          {
            id: 'genset_deploy',
            question: 'Has auxiliary 5kVA genset or mobile DC power supply been energized?',
            options: [
              { label: 'Genset online: Rectifier charging battery bank back to float (-53.5V)', next: 'restore_float' },
              { label: 'Awaiting fuel or emergency power dispatch to site', next: 'escalate_facility' },
            ],
          },
        ];

      case 'LINK_DOWN':
        return [
          {
            id: 'power_check',
            question: 'Is IDU NR9150 powered on with Green PWR LED illuminated?',
            options: [
              { label: 'No PWR LED / Dark chassis', next: 'power_isolated' },
              { label: 'Yes, IDU is powered, IF LED is red/blinking', next: 'check_odu_power' },
            ],
          },
          {
            id: 'power_isolated',
            question: 'Check DCPDB breaker slot CB-07. Is breaker tripped or blown?',
            options: [
              { label: 'Breaker tripped to OFF position', next: 'reset_breaker' },
              { label: 'Breaker is ON, but multimeter reads 0V (Inspect battery curve below)', next: 'rectifier_check' },
            ],
          },
        ];

      default:
        return [
          {
            id: 'general_check',
            question: 'Perform diagnostic loopback test on IDU IF port.',
            options: [
              { label: 'Loopback passes cleanly', next: 'rf_path' },
              { label: 'Loopback fails on IDU hardware', next: 'rma_idu' },
            ],
          },
        ];
    }
  };

  const decisionSteps = getDecisionSteps();
  const currentStep = decisionSteps[activeStep] || decisionSteps[0];

  const handleSelectOption = (option: { label: string; next: string }) => {
    setAnswers((prev) => ({ ...prev, [currentStep.id]: option.label }));
    if (activeStep < decisionSteps.length - 1) {
      setActiveStep(activeStep + 1);
    } else {
      // Auto-populate diagnostic recommendation based on symptom
      if (selectedSymptom === 'LOW_RSL') {
        setRootCause(
          'Antenna azimuth drifted by ~3.4° due to untorqued turnbuckle on Leg C AMB mount after coastal gusts.'
        );
        setActionTaken(
          'Panned 1.2m dish back to 241.02° target azimuth. Peaked RSL to -27.2 dBm. Re-torqued clamps to 48 N·m.'
        );
      } else if (selectedSymptom === 'POWER_FAILURE') {
        setRootCause(
          'Commercial grid feeder drop occurred at 14:00. Battery bank sustained load for 8h down to -44.6V before genset recharge restored float charge.'
        );
        setActionTaken(
          'Verified battery telemetry in cache (-48.2V DC), reset 32A DCPDB breaker, and confirmed rectifier modules delivering -53.5V nominal float.'
        );
      } else {
        setRootCause('Power supply interruption or breaker trip on -48V DC feed.');
        setActionTaken('Restored breaker, verified -48.2V DC polarity, and restarted NR9150.');
      }
    }
  };

  const handleSaveTicket = () => {
    const newTicket: TroubleshootingTicket = {
      id: 'tkt_' + Date.now(),
      orgId: activeUser.orgId,
      ticketNumber: `TKT-2026-MW-${Math.floor(1000 + Math.random() * 9000)}`,
      hopId: hop.id,
      siteId: site.id,
      symptom: selectedSymptom,
      severity: selectedSymptom === 'LINK_DOWN' || selectedSymptom === 'POWER_FAILURE' ? 'CRITICAL' : 'MAJOR',
      findings: Object.entries(answers).map(([k, v]) => `${k}: ${v}`),
      measurements,
      rootCause: rootCause || 'Antenna azimuth misalignment or DC supply drop.',
      actionTaken: actionTaken || 'Realignment, power restoration, and battery curve audit completed.',
      outcome: resolutionOutcome,
      mttrMinutes: 45,
      status: resolutionOutcome === 'RESOLVED' ? 'RESOLVED' : 'INVESTIGATING',
      createdAt: new Date().toISOString(),
      assignedTechnician: activeUser.name,
    };

    storage.saveTicket(newTicket);
    alert(`Troubleshooting Ticket ${newTicket.ticketNumber} logged and saved!`);
  };

  return (
    <div className="space-y-4">
      {/* Module Header */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          sunlightMode
            ? 'bg-amber-50 border-amber-400 text-black'
            : 'bg-slate-900 border-slate-800 text-slate-100'
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-rose-400" />
            <h2 className="text-base font-bold text-white">
              Module 3: Microwave Troubleshooting & Diagnostics
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Diagnostic decision trees, Recharts battery discharge telemetry, and MTTR tracking for Hop {hop.hopName}.
          </p>
        </div>

        {/* Symptom Selector */}
        <select
          value={selectedSymptom}
          onChange={(e) => {
            const nextSym = e.target.value as any;
            setSelectedSymptom(nextSym);
            setActiveStep(0);
            setAnswers({});
            if (nextSym === 'POWER_FAILURE') {
              setActiveTab('BATTERY_CHART');
            }
          }}
          className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 font-mono text-cyan-400 text-xs font-bold"
        >
          <option value="LOW_RSL">Symptom: Low RSL / Path Loss</option>
          <option value="LINK_DOWN">Symptom: Total Link Down</option>
          <option value="POWER_FAILURE">Symptom: Power / Battery Discharge Drop</option>
          <option value="HIGH_BER">Symptom: High Errors / BER Degradation</option>
          <option value="XPIC_DEGRADED">Symptom: XPIC Cross-Polarization Failure</option>
          <option value="FLAPPING">Symptom: Link Flapping / Modulation Drops</option>
        </select>
      </div>

      {/* Troubleshooting Sub-Navigation Tabs */}
      <div className="flex gap-2 p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('DECISION_TREE')}
          className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === 'DECISION_TREE'
              ? 'bg-cyan-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>Diagnostic Tree & Tests</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('BATTERY_CHART')}
          className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === 'BATTERY_CHART'
              ? 'bg-cyan-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Battery className="w-3.5 h-3.5 text-cyan-400" />
          <span>24h Battery Discharge Curve (Recharts)</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
            CACHE ACTIVE
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('TICKETS')}
          className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === 'TICKETS'
              ? 'bg-cyan-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Ticket Ledger ({tickets.length})</span>
        </button>
      </div>

      {/* TAB 1: DIAGNOSTIC DECISION TREE */}
      {activeTab === 'DECISION_TREE' && (
        <div className="space-y-4">
          <div className="p-4 sm:p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 text-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-mono font-bold text-cyan-400 uppercase">
                Branch {activeStep + 1} of {decisionSteps.length}: {currentStep.id.toUpperCase()}
              </span>
              <button
                onClick={() => {
                  setActiveStep(0);
                  setAnswers({});
                  setRootCause('');
                  setActionTaken('');
                }}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Reset Tree
              </button>
            </div>

            {/* Question Prompt */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <h4 className="font-bold text-sm text-white leading-snug">{currentStep.question}</h4>

              <div className="space-y-2">
                {currentStep.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectOption(opt)}
                    className="w-full p-3 rounded-lg bg-slate-900 hover:bg-cyan-950/60 border border-slate-800 hover:border-cyan-700 text-left text-xs font-medium text-slate-200 flex items-center justify-between transition-colors group"
                  >
                    <span>{opt.label}</span>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400" />
                  </button>
                ))}
              </div>
            </div>

            {/* If diagnosing Power Failure, render Battery Chart inline for immediate inspection */}
            {selectedSymptom === 'POWER_FAILURE' && (
              <div className="pt-2">
                <BatteryDischargeChart
                  site={site}
                  currentVoltage={measurements.voltageDc}
                  onVoltageSelected={(v) => {
                    setMeasurements((prev) => ({ ...prev, voltageDc: v }));
                  }}
                  sunlightMode={sunlightMode}
                />
              </div>
            )}

            {/* Measurements Entry */}
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <label className="text-slate-400 block text-[11px]">Measured RSL (dBm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={measurements.measuredRslDbm ?? ''}
                  onChange={(e) =>
                    setMeasurements({ ...measurements, measuredRslDbm: parseFloat(e.target.value) })
                  }
                  className="w-full mt-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-cyan-400 text-xs font-bold"
                />
              </div>
              <div>
                <div className="flex items-center justify-between text-[11px]">
                  <label className="text-slate-400">DC Voltage (V)</label>
                  <button
                    type="button"
                    onClick={() => setActiveTab('BATTERY_CHART')}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono"
                  >
                    View Curve
                  </button>
                </div>
                <input
                  type="number"
                  step="0.1"
                  value={measurements.voltageDc ?? ''}
                  onChange={(e) =>
                    setMeasurements({ ...measurements, voltageDc: parseFloat(e.target.value) })
                  }
                  className="w-full mt-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-emerald-400 text-xs font-bold"
                />
              </div>
              <div>
                <label className="text-slate-400 block text-[11px]">Bit Error Rate (BER)</label>
                <input
                  type="text"
                  value={measurements.berValue ?? ''}
                  onChange={(e) => setMeasurements({ ...measurements, berValue: e.target.value })}
                  className="w-full mt-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-white text-xs"
                />
              </div>
              <div>
                <label className="text-slate-400 block text-[11px]">ODU Temp (°C)</label>
                <input
                  type="number"
                  value={measurements.temperatureC ?? ''}
                  onChange={(e) =>
                    setMeasurements({ ...measurements, temperatureC: parseFloat(e.target.value) })
                  }
                  className="w-full mt-1 px-2 py-1 rounded bg-slate-900 border border-slate-700 font-mono text-white text-xs"
                />
              </div>
            </div>

            {/* Diagnosis & Action Summary */}
            <div className="space-y-3 pt-2 text-xs">
              <div>
                <label className="font-bold text-slate-200 block mb-1">Root Cause Identification</label>
                <input
                  type="text"
                  placeholder="e.g. Utility outage sustained by battery; turnbuckle drift on Leg C"
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-white font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-200 block mb-1">Corrective Action Taken</label>
                <textarea
                  rows={2}
                  placeholder="Describe realignment, genset restoration, or breaker reset performed..."
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Resolution Outcome:</span>
                  <select
                    value={resolutionOutcome}
                    onChange={(e) => setResolutionOutcome(e.target.value as any)}
                    className="px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 font-mono text-cyan-400 font-bold"
                  >
                    <option value="RESOLVED">Resolved on Site (Pass)</option>
                    <option value="ESCALATED_NOC">Escalate to NOC</option>
                    <option value="ESCALATED_VENDOR">Escalate to Huawei / Vendor</option>
                    <option value="SPARE_REQUIRED">Spare Part Required</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleSaveTicket}
                  className="px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 font-bold text-white flex items-center gap-1.5 shadow"
                >
                  <FileCheck2 className="w-4 h-4" />
                  Save Diagnostic Ticket
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RECHARTS BATTERY DISCHARGE GRAPH */}
      {activeTab === 'BATTERY_CHART' && (
        <div className="space-y-4">
          <BatteryDischargeChart
            site={site}
            currentVoltage={measurements.voltageDc}
            onVoltageSelected={(v) => {
              setMeasurements((prev) => ({ ...prev, voltageDc: v }));
              alert(`Updated DC Voltage in diagnostic form to ${v}V DC`);
            }}
            sunlightMode={sunlightMode}
          />
        </div>
      )}

      {/* TAB 3: TICKETS LEDGER */}
      {activeTab === 'TICKETS' && (
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              Troubleshooting Ticket History & Audit Records
            </h3>
            <span className="text-xs font-mono text-slate-400">
              {tickets.length} Registered Tickets
            </span>
          </div>

          <div className="space-y-2">
            {tickets.map((tkt) => (
              <div
                key={tkt.id}
                className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-cyan-400">{tkt.ticketNumber}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${
                      tkt.status === 'RESOLVED'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}
                  >
                    {tkt.status}
                  </span>
                </div>
                <p className="text-slate-200">
                  <strong>Root Cause:</strong> {tkt.rootCause}
                </p>
                <p className="text-slate-400 text-[11px]">
                  <strong>Action:</strong> {tkt.actionTaken}
                </p>
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1">
                  <span>Tech: {tkt.assignedTechnician}</span>
                  <span>MTTR: {tkt.mttrMinutes} min</span>
                  <span>Voltage: {tkt.measurements.voltageDc ?? -48.2}V DC</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
