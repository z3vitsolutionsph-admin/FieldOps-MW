import React, { useState } from 'react';
import {
  Radio,
  ShieldCheck,
  UserCheck,
  HardHat,
  Wrench,
  ClipboardCheck,
  Briefcase,
  ArrowRight,
  ShieldAlert,
  AlertCircle,
  LogOut,
  X,
  User,
  Building,
} from 'lucide-react';
import { UserProfile, UserRole } from '../../types/fieldops';
import { storage } from '../../services/storageService';
import { SEED_USERS } from '../../data/seedData';
import { AUTH_MODE, signOut } from '../../services/authService';

interface LoginPageProps {
  onLoginSuccess: (user: UserProfile, targetFlowStep?: 'TSSR' | 'DASHBOARD' | 'JOBS') => void;
  onClose?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onClose }) => {
  const activeUser = storage.getActiveUser();

  // -------------------------------------------------------------
  // FIREBASE PRODUCTION MODE: ACCOUNT PANEL (NO ROLE PICKER)
  // -------------------------------------------------------------
  if (AUTH_MODE === 'firebase') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white font-mono">Authenticated Account</h2>
                <p className="text-xs text-slate-400 font-mono">FieldOps Enterprise Session</p>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Close"
                className="min-h-[44px] min-w-[44px] rounded-lg text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="mt-5 space-y-4">
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-1">
                Full Name
              </div>
              <div className="text-sm font-semibold text-white">{activeUser.name}</div>

              <div className="text-xs text-slate-500 font-mono uppercase tracking-wider mt-3 mb-1">
                Email Address
              </div>
              <div className="text-sm font-mono text-slate-300">{activeUser.email}</div>

              <div className="text-xs text-slate-500 font-mono uppercase tracking-wider mt-3 mb-1">
                Assigned Operational Role
              </div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-800 text-xs font-mono font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                {activeUser.role}
              </div>

              <div className="text-xs text-slate-500 font-mono uppercase tracking-wider mt-3 mb-1">
                Organization Tenant
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                <Building className="w-3.5 h-3.5 text-slate-500" />
                {activeUser.orgId || 'org-crane-ph'}
              </div>
            </div>

            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-400 font-mono flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>Need a different role? Ask your administrator to update your organization and role claims.</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 mt-6 pt-4 border-t border-slate-800">
            {onClose && (
              <button
                onClick={onClose}
                className="w-full min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg flex items-center justify-center transition-colors cursor-pointer"
              >
                Close
              </button>
            )}
            <button
              onClick={async () => {
                await signOut();
                if (onClose) onClose();
              }}
              className="w-full min-h-[44px] bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // DEV MODE: ROLE PICKER WITH AMBER DEMO NOTICE (PIN FIELD REMOVED)
  // -------------------------------------------------------------
  const allUsers = SEED_USERS;
  const [selectedRole, setSelectedRole] = useState<UserRole>('PROJECT_MANAGER');
  const [selectedUser, setSelectedUser] = useState<UserProfile>(
    allUsers.find((u) => u.role === 'PROJECT_MANAGER') || allUsers[0]
  );
  const [customEmail, setCustomEmail] = useState(selectedUser.email);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    const found = allUsers.find((u) => u.role === role);
    if (found) {
      setSelectedUser(found);
      setCustomEmail(found.email);
    }
  };

  const getRoleDetails = (role: UserRole) => {
    switch (role) {
      case 'PROJECT_MANAGER':
        return {
          title: 'Project Manager',
          badgeColor: 'bg-blue-950 text-blue-300 border-blue-700',
          icon: <Briefcase className="w-5 h-5 text-blue-400" />,
          description:
            'Oversees project schedules, milestone tracking, resource allocation, and PDF report generation. Uploads TSSR to bind Microwave Hop, Regional Sites, and Work Orders.',
          privileges: [
            'View All Work Orders',
            'Assigned Work Orders (Team Leader)',
            'Export Reports',
            'Milestone Tracking',
            'Cost & Schedule Audits',
            'Upload TSSR & Project Parameter Extraction',
          ],
        };
      case 'TEAM_LEADER':
        return {
          title: 'Team Leader',
          badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-700',
          icon: <UserCheck className="w-5 h-5 text-emerald-400" />,
          description:
            'Manages field crews, reviews pre-climb safety checklists, and authorizes high-risk tower operations.',
          privileges: [
            'QR/Barcode Inventory Scan',
            'Battery Discharge Telemetry',
            'Field Data Logging',
            'Approve Pre-Climb Checklists',
            'Incident & Hazard Logging',
            'Crew Safety Oversight',
            'Photo Capture & Upload',
          ],
        };
      case 'ADMIN':
        return {
          title: 'System Administrator',
          badgeColor: 'bg-purple-950 text-purple-300 border-purple-700',
          icon: <ShieldCheck className="w-5 h-5 text-purple-400" />,
          description:
            'Full system control, global RBAC configuration, user management, and offline cache synchronization.',
          privileges: [
            'View All Work Orders',
            'Upload TSSR & Override Hops',
            'Manage Users & Roles',
            'Full Audit Trail Access',
            'Database Schema & Sync Control',
          ],
        };
      case 'REVIEWER':
        return {
          title: 'TSSR & Engineering Reviewer',
          badgeColor: 'bg-indigo-950 text-indigo-300 border-indigo-700',
          icon: <ClipboardCheck className="w-5 h-5 text-indigo-400" />,
          description:
            'Reviews transport RF parameters, approves antenna centerline heights, and verifies regulatory clearance.',
          privileges: [
            '3-Gate TSSR Approvals',
            'Engineering Elevation Audits',
            'Reject Incomplete Dossiers',
            'View All Work Orders',
          ],
        };
      case 'SUPERVISOR':
        return {
          title: 'Regional Field Supervisor',
          badgeColor: 'bg-amber-950 text-amber-300 border-amber-700',
          icon: <HardHat className="w-5 h-5 text-amber-400" />,
          description:
            'Conducts job hazard analysis (JHA), validates PPE, logs weather aborts, and executes safety override signs.',
          privileges: [
            'Safety Gate Authorization',
            'Pre-Climb Clearance Override',
            'Weather Abort Protocol',
            'Job Hazard Analysis (JHA)',
          ],
        };
      case 'TOWER_CLIMBER':
        return {
          title: 'Certified Tower Climber & Rigger',
          badgeColor: 'bg-rose-950 text-rose-300 border-rose-700',
          icon: <HardHat className="w-5 h-5 text-rose-400" />,
          description:
            'High-altitude tower rigging, parabolic antenna mounting, azimuth alignment, and waveguide weatherproofing.',
          privileges: [
            'Tower Rigging Checklist',
            'High-Altitude Antenna Alignment',
            'Visual & Torque Proof Photos',
            'Fall Arrest Equipment Check',
          ],
        };
      case 'TECHNICIAN':
      default:
        return {
          title: 'Field Installation Technician',
          badgeColor: 'bg-cyan-950 text-cyan-300 border-cyan-700',
          icon: <Wrench className="w-5 h-5 text-cyan-400" />,
          description:
            'Performs ground equipment installation, IDU/ODU configuration, inventory QR scans, and cable tests.',
          privileges: [
            'QR/Barcode Inventory Scan',
            'Battery Discharge Telemetry',
            'Field Data Logging',
            'Photo Capture & Upload',
          ],
        };
    }
  };

  const roleInfo = getRoleDetails(selectedRole);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    setTimeout(() => {
      try {
        const updatedUser: UserProfile = {
          ...selectedUser,
          email: customEmail || selectedUser.email,
        };
        storage.setActiveUser(updatedUser);
        setIsLoading(false);

        const targetStep = selectedRole === 'PROJECT_MANAGER' ? 'TSSR' : 'DASHBOARD';
        onLoginSuccess(updatedUser, targetStep);
        if (onClose) onClose();
      } catch (err: any) {
        setIsLoading(false);
        setErrorMsg(err.message || 'Authentication failed');
      }
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white font-mono flex items-center gap-2">
                FIELDOPS <span className="text-cyan-400">TELECOM</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-700/60">
                  DEV MODE
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-mono">Role-Based Access Control Simulation</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="min-h-[44px] min-w-[44px] rounded-lg text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-0">
          {/* Role Selection Palette */}
          <div className="md:col-span-5 p-4 sm:p-5 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950/40 space-y-3">
            <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Select Sample Identity</span>
              <span className="text-cyan-400 text-[10px]">7 Preset Roles</span>
            </div>

            <div className="space-y-1.5">
              {(
                [
                  'PROJECT_MANAGER',
                  'TEAM_LEADER',
                  'TECHNICIAN',
                  'TOWER_CLIMBER',
                  'SUPERVISOR',
                  'REVIEWER',
                  'ADMIN',
                ] as UserRole[]
              ).map((role) => {
                const info = getRoleDetails(role);
                const isSelected = selectedRole === role;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleRoleSelect(role)}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between min-h-[44px] ${
                      isSelected
                        ? 'bg-slate-800/90 border-cyan-500 shadow-md shadow-cyan-950'
                        : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/40 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-lg border ${info.badgeColor}`}>{info.icon}</div>
                      <div>
                        <div className={`text-xs font-bold font-mono ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                          {info.title}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {role === 'PROJECT_MANAGER' && 'Ingests TSSR & Schedules'}
                          {role === 'TEAM_LEADER' && 'Pre-Climb Sign-Off'}
                          {role === 'TECHNICIAN' && 'Commissioning & Telemetry'}
                          {role === 'TOWER_CLIMBER' && 'Rigging & Parabolic Alignment'}
                          {role === 'SUPERVISOR' && 'Safety Oversight & JHA'}
                          {role === 'REVIEWER' && 'Transport ACL Clearance'}
                          {role === 'ADMIN' && 'Full Root Control'}
                        </div>
                      </div>
                    </div>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Identity Confirmation Form */}
          <div className="md:col-span-7 p-4 sm:p-6 space-y-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-md border text-xs font-mono font-bold ${roleInfo.badgeColor}`}>
                    {roleInfo.title}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed mb-4 bg-slate-950/60 border border-slate-800/60 p-3 rounded-xl">
                {roleInfo.description}
              </p>

              {/* AMBER DEMO NOTICE: REPLACING OLD PIN FIELD */}
              <div className="p-3.5 bg-amber-950/40 border border-amber-500/30 rounded-xl text-amber-300 text-xs font-mono flex items-start gap-2.5 mb-4">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>Demo mode: you are choosing a sample identity, not signing in. Production builds require a real account.</span>
              </div>

              <form onSubmit={handleLogin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Corporate Identity / Active User</label>
                  <select
                    value={selectedUser.id}
                    onChange={(e) => {
                      const u = allUsers.find((usr) => usr.id === e.target.value);
                      if (u) {
                        setSelectedUser(u);
                        setCustomEmail(u.email);
                      }
                    }}
                    className="w-full min-h-[44px] bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:border-cyan-500 outline-none cursor-pointer"
                  >
                    {allUsers
                      .filter((u) => u.role === selectedRole)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Assigned Email</label>
                  <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    className="w-full min-h-[44px] bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:border-cyan-500 outline-none"
                    required
                  />
                </div>

                {errorMsg && (
                  <div className="p-2.5 bg-rose-950/80 border border-rose-800 rounded-lg text-xs text-rose-200 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full min-h-[44px] py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white text-xs font-bold font-mono rounded-xl shadow-lg shadow-cyan-950 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer mt-2"
                >
                  {isLoading ? (
                    <span className="animate-spin text-xs">Switching Identity...</span>
                  ) : (
                    <>
                      <span>Assume {roleInfo.title} Identity</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="pt-3 border-t border-slate-800 text-center">
              <p className="text-[11px] text-slate-500 font-mono">
                Assumed role claims will be attached to outgoing REST API calls via <span className="text-cyan-400">Bearer dev:{selectedUser.id}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
