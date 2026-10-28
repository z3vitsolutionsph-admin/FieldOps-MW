import React, { useState } from 'react';
import {
  Radio,
  ShieldCheck,
  UserCheck,
  Lock,
  HardHat,
  Wrench,
  ClipboardCheck,
  Briefcase,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Building2,
  UserPlus,
  LogIn,
  Upload,
  Layers,
  FileText,
  Activity,
  CheckSquare,
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
  const [authMode, setAuthMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const allUsers = SEED_USERS;
  const [selectedRole, setSelectedRole] = useState<UserRole>('PROJECT_MANAGER');
  const [selectedUser, setSelectedUser] = useState<UserProfile>(
    allUsers.find((u) => u.role === 'PROJECT_MANAGER') || allUsers[0]
  );

  // Form states
  const [customEmail, setCustomEmail] = useState(selectedUser.email);
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('+63 917 555 0199');
  const [signupCert, setSignupCert] = useState('Certified Microwave Engineering Lead');
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
          description: 'Oversees project schedules, milestone tracking, resource allocation, and PDF report generation. Uploads TSSR to bind Microwave Hop, Regional Sites, and Work Orders.',
          flowTitle: 'Project Manager Flow',
          flowSteps: [
            { label: 'Login Page', desc: 'Secure RBAC auth' },
            { label: 'Signup', desc: 'Register / PMP Creds' },
            { label: 'Upload TSSR', desc: 'Ingest Hop & Sites' },
            { label: 'Dashboard', desc: 'Regional directory' },
            { label: 'Jobs', desc: 'Work order schedule' },
            { label: 'Steps', desc: 'Field milestone check' },
            { label: 'Completed', desc: 'Executive dossier signoff' },
          ],
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
          description: 'Manages field crews, reviews pre-climb safety checklists, and authorizes high-risk tower operations. Performs ground equipment installation, IDU/ODU configuration, inventory QR scans, and cable tests.',
          flowTitle: 'Team Leader Flow',
          flowSteps: [
            { label: 'Login Page', desc: 'Field gateway' },
            { label: 'Signup', desc: 'Crew leader creds' },
            { label: 'Dashboard', desc: 'Active site & weather' },
            { label: 'Jobs', desc: 'Select active hop' },
            { label: 'Steps', desc: 'Pre-climb & rigging' },
            { label: 'Completed', desc: 'Safety gate signoff' },
          ],
          privileges: [
            'QR/Barcode Inventory Scan',
            'Battery Discharge Telemetry',
            'Field Data Logging',
            'Approve Pre-Climb Checklists',
            'Incident & Hazard Logging',
            'Crew Safety Oversight',
            'Photo Capture & Upload',
            'Mandatory Pre-Climb Check',
            'Height & Rigging Execution',
          ],
        };
      case 'ADMIN':
        return {
          title: 'System Administrator',
          badgeColor: 'bg-purple-950 text-purple-300 border-purple-700',
          icon: <ShieldCheck className="w-5 h-5 text-purple-400" />,
          description: 'Full system control, global RBAC configuration, user management, and offline cache synchronization.',
          flowTitle: 'Admin Flow',
          flowSteps: [
            { label: 'Login Page', desc: 'Superuser portal' },
            { label: 'Dashboard', desc: 'Full infrastructure' },
            { label: 'Jobs', desc: 'Global execution' },
            { label: 'Completed', desc: 'All privileges granted' },
          ],
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
          description: 'Validates microwave path calculations, azimuth angles, antenna specs, and as-built photo evidence.',
          flowTitle: 'Reviewer Flow',
          flowSteps: [
            { label: 'Login Page', desc: 'QA auth' },
            { label: 'Dashboard', desc: 'Audit dashboard' },
            { label: 'Jobs', desc: 'Reviewer clearance' },
            { label: 'Completed', desc: 'QA technical signoff' },
          ],
          privileges: [
            'Approve/Reject TSSR Sheets',
            'Audit Photo Evidence',
            'Verify RF Path Margins',
            'Compliance Sign-off',
          ],
        };
      case 'SUPERVISOR':
        return {
          title: 'Site Operations Supervisor',
          badgeColor: 'bg-amber-950 text-amber-300 border-amber-700',
          icon: <UserCheck className="w-5 h-5 text-amber-400" />,
          description: 'Manages regional logistics, authorizes high-risk permits, and coordinates client site access.',
          flowTitle: 'Supervisor Flow',
          flowSteps: [
            { label: 'Login Page', desc: 'Field supervisor' },
            { label: 'Dashboard', desc: 'Regional operations' },
            { label: 'Jobs', desc: 'Safety permits' },
            { label: 'Completed', desc: 'Site signoff' },
          ],
          privileges: [
            'Approve Pre-Climb Checklists',
            'Assign Work Orders',
            'Incident & Hazard Logging',
            'Crew Safety Oversight',
          ],
        };
      case 'TOWER_CLIMBER':
        return {
          title: 'Certified Tower Climber',
          badgeColor: 'bg-rose-950 text-rose-300 border-rose-700',
          icon: <HardHat className="w-5 h-5 text-rose-400" />,
          description: 'Executes high-altitude antenna rigging, TMA installation, cabling, and safety harness logs.',
          flowTitle: 'Climber Flow',
          flowSteps: [
            { label: 'Login Page', desc: 'Climber terminal' },
            { label: 'Dashboard', desc: 'Weather & wind shear' },
            { label: 'Jobs', desc: 'Mandatory PPE' },
            { label: 'Steps', desc: 'Rigging execution' },
            { label: 'Completed', desc: 'Climb log saved' },
          ],
          privileges: [
            'Mandatory Pre-Climb Check',
            'Height & Rigging Execution',
            'Photo Capture & Upload',
            'Battery Discharge Telemetry',
          ],
        };
      case 'TECHNICIAN':
      default:
        return {
          title: 'Field Installation Technician',
          badgeColor: 'bg-cyan-950 text-cyan-300 border-cyan-700',
          icon: <Wrench className="w-5 h-5 text-cyan-400" />,
          description: 'Performs ground equipment installation, IDU/ODU configuration, inventory QR scans, and cable tests.',
          flowTitle: 'Technician Flow',
          flowSteps: [
            { label: 'Login Page', desc: 'Tech terminal' },
            { label: 'Dashboard', desc: 'Assigned jobs' },
            { label: 'Jobs', desc: 'Equipment install' },
            { label: 'Steps', desc: 'Field data logging' },
            { label: 'Completed', desc: 'As-built submission' },
          ],
          privileges: [
            'QR/Barcode Inventory Scan',
            'Battery Discharge Telemetry',
            'Field Data Logging',
            'Photo Capture & Upload',
          ],
        };
    }
  };

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

        // Prescribed User Flow Navigation
        const targetStep = selectedRole === 'PROJECT_MANAGER' ? 'TSSR' : 'DASHBOARD';
        onLoginSuccess(updatedUser, targetStep);
        if (onClose) onClose();
      } catch (err: any) {
        setIsLoading(false);
        setErrorMsg(err.message || 'Authentication failed');
      }
    }, 350);
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupName.trim() || !signupEmail.trim()) {
      setErrorMsg('Please enter your full name and valid corporate email.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    setTimeout(() => {
      try {
        const newUser: UserProfile = {
          id: `user-${Date.now()}`,
          name: signupName.trim(),
          email: signupEmail.trim(),
          role: selectedRole,
          orgId: 'org-crane-ph',
          phone: signupPhone.trim(),
          certifications: [signupCert],
          climberLicenseNo: selectedRole === 'TEAM_LEADER' ? `LEAD-PH-${new Date().getFullYear()}-01` : undefined,
        };

        storage.setActiveUser(newUser);
        setIsLoading(false);

        // Prescribed User Flow Navigation
        // Project Manager: Login Page > Signup > Upload TSSR > Dashboard > Jobs > Steps > Completed
        // Team Leader: Login Page > Signup > Dashboard > Jobs > Steps > Completed
        const targetStep = selectedRole === 'PROJECT_MANAGER' ? 'TSSR' : 'DASHBOARD';
        onLoginSuccess(newUser, targetStep);
        if (onClose) onClose();
      } catch (err: any) {
        setIsLoading(false);
        setErrorMsg(err.message || 'Signup failed');
      }
    }, 400);
  };

  const currentDetails = getRoleDetails(selectedRole);

  // With real accounts, roles are assigned by an administrator; there is nothing to pick here.
  if (AUTH_MODE === 'firebase') {
    const me = storage.getActiveUser();
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
        <section className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4" aria-labelledby="account-title">
          <h2 id="account-title" className="text-base font-semibold text-white">Your account</h2>
          <dl className="text-sm space-y-1 text-slate-300">
            <div className="flex justify-between gap-4"><dt className="text-slate-400">Name</dt><dd>{me.name}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-400">Email</dt><dd className="truncate">{me.email}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-400">Role</dt><dd>{me.role.replace(/_/g, ' ')}</dd></div>
          </dl>
          <p className="text-xs text-slate-400">Need a different role? Ask your administrator.</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 min-h-11 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-slate-100">Close</button>
            <button
              onClick={() => signOut().then(() => window.location.reload())}
              className="flex-1 min-h-11 rounded-lg bg-rose-700 hover:bg-rose-600 text-sm font-semibold text-white"
            >
              Sign out
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="max-w-5xl w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-cyan-950/60 overflow-hidden flex flex-col lg:flex-row my-auto">
        
        {/* Left Side: Role Selector Grid & Prescribed Flow Visualization */}
        <div className="w-full lg:w-1/2 p-5 sm:p-6 bg-slate-950/80 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col justify-between">
          <div>
            {/* Header branding */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-900/40">
                <Radio className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-extrabold text-white tracking-tight">FieldOps MW</h1>
                  <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-700/80">
                    ENTERPRISE RBAC
                  </span>
                </div>
                <p className="text-xs text-slate-400">Microwave Link & TSSR Portal</p>
              </div>
            </div>

            {/* Mode Switcher: Sign In vs Sign Up */}
            <div className="flex p-1 rounded-xl bg-slate-900 border border-slate-800 mb-4">
              <button
                type="button"
                onClick={() => setAuthMode('LOGIN')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all ${
                  authMode === 'LOGIN'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>1. Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('SIGNUP');
                  if (!signupEmail) setSignupEmail(selectedUser.email);
                  if (!signupName) setSignupName(selectedUser.name);
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all ${
                  authMode === 'SIGNUP'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>2. Signup / Register</span>
              </button>
            </div>

            <p className="text-xs text-slate-300 mb-3">
              Select your operational role. Workflow routing and permissions adapt to role requirements:
            </p>

            {/* Role Cards Grid with Primary Roles Highlighted */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {(
                [
                  {
                    role: 'PROJECT_MANAGER',
                    label: 'Project Manager',
                    desc: 'Oversees schedules, audits & uploads TSSR',
                    icon: <Briefcase className="w-4 h-4 text-blue-400" />,
                    isPrimary: true,
                  },
                  {
                    role: 'TEAM_LEADER',
                    label: 'Team Leader',
                    desc: 'Crews, pre-climb safety & rigging',
                    icon: <UserCheck className="w-4 h-4 text-emerald-400" />,
                    isPrimary: true,
                  },
                  {
                    role: 'TECHNICIAN',
                    label: 'Technician',
                    desc: 'Ground equipment & IDU/ODU',
                    icon: <Wrench className="w-4 h-4 text-cyan-400" />,
                    isPrimary: false,
                  },
                  {
                    role: 'TOWER_CLIMBER',
                    label: 'Tower Climber',
                    desc: 'High-altitude antenna rigging',
                    icon: <HardHat className="w-4 h-4 text-rose-400" />,
                    isPrimary: false,
                  },
                  {
                    role: 'REVIEWER',
                    label: 'Reviewer',
                    desc: 'TSSR QA & technical audit',
                    icon: <ClipboardCheck className="w-4 h-4 text-indigo-400" />,
                    isPrimary: false,
                  },
                  {
                    role: 'ADMIN',
                    label: 'System Admin',
                    desc: 'Full system & schema access',
                    icon: <ShieldCheck className="w-4 h-4 text-purple-400" />,
                    isPrimary: false,
                  },
                ] as const
              ).map((item) => {
                const isSelected = selectedRole === item.role;
                return (
                  <button
                    key={item.role}
                    type="button"
                    onClick={() => handleRoleSelect(item.role)}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all relative ${
                      isSelected
                        ? 'bg-cyan-950/90 border-cyan-400 text-white ring-1 ring-cyan-500/50 shadow-md'
                        : item.isPrimary
                        ? 'bg-slate-900/90 border-slate-700/80 text-slate-200 hover:border-cyan-700'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${isSelected ? 'bg-cyan-900/80' : 'bg-slate-800'}`}>
                      {item.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-100 truncate">{item.label}</span>
                        {item.isPrimary && (
                          <span className="text-xs font-mono px-1 py-0.5 rounded bg-cyan-900/60 text-cyan-300 font-bold">
                            KEY ROLE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{item.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Prescribed User Flow Walkthrough Stepper */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  Prescribed Workflow: {currentDetails.flowTitle}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {currentDetails.flowSteps.length} Milestones
                </span>
              </div>

              {/* Stepper horizontal ribbon */}
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1">
                {currentDetails.flowSteps.map((step, idx) => (
                  <React.Fragment key={idx}>
                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-950 text-cyan-300 border border-slate-800 whitespace-nowrap">
                        {idx + 1}. {step.label}
                      </span>
                      <span className="text-xs text-slate-500 font-mono mt-0.5 truncate max-w-[80px]">
                        {step.desc}
                      </span>
                    </div>
                    {idx < currentDetails.flowSteps.length - 1 && (
                      <span className="text-slate-600 text-xs shrink-0 mx-0.5 font-bold">→</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-mono">
              <Building2 className="w-3.5 h-3.5 text-cyan-400" />
              TowerLink Telecom Philippines Inc.
            </span>
            <span className="font-mono text-cyan-400 font-bold">v2.6 Enterprise</span>
          </div>
        </div>

        {/* Right Side: Credentials & Role Privileges Form */}
        <div className="w-full lg:w-1/2 p-5 sm:p-6 flex flex-col justify-between bg-slate-900">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2.5 py-1 rounded-full border font-mono font-bold flex items-center gap-1.5 ${currentDetails.badgeColor}`}>
                  {currentDetails.icon}
                  {currentDetails.title}
                </span>
              </div>
              {onClose && (
                <button
                  onClick={onClose}
                  className="text-slate-400 hover:text-white text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700"
                >
                  ✕ Close
                </button>
              )}
            </div>

            <p className="text-xs text-slate-300 mb-3 leading-relaxed">
              {currentDetails.description}
            </p>

            {/* Privileges checklist */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 mb-4">
              <div className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Assigned RBAC Privileges:
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {currentDetails.privileges.map((perm, idx) => (
                  <li key={idx} className="text-xs text-slate-300 flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{perm}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Note about TSSR Data Binding */}
            {selectedRole === 'PROJECT_MANAGER' && (
              <div className="mb-4 p-2.5 rounded-lg bg-blue-950/50 border border-blue-800/80 text-xs text-blue-200 flex items-start gap-2">
                <Upload className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>TSSR Authority:</strong> Microwave Hop geometry, Regional Sites Directory, and Work Orders Schedule will be derived directly from the TSSR file uploaded by the Project Manager.
                </span>
              </div>
            )}

            {/* LOGIN FORM */}
            {authMode === 'LOGIN' && (
              <form onSubmit={handleLogin} className="space-y-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Personnel Profile</label>
                  <input
                    type="text"
                    value={selectedUser.name}
                    disabled
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Corporate Email</label>
                  <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                    required
                  />
                </div>

                <p className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-800 text-xs text-amber-200">
                  Demo mode: you are choosing a sample identity, not signing in. Production builds require a real account.
                </p>

                {errorMsg && (
                  <div className="p-2.5 bg-rose-950/80 border border-rose-800 rounded-lg text-xs text-rose-200 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white text-xs font-bold font-mono rounded-xl shadow-lg shadow-cyan-950 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="animate-spin text-xs">Authenticating Session...</span>
                  ) : (
                    <>
                      <span>Sign In & Enter {selectedRole === 'PROJECT_MANAGER' ? 'Upload TSSR Flow' : 'Dashboard Flow'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* SIGNUP FORM */}
            {authMode === 'SIGNUP' && (
              <form onSubmit={handleSignup} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Full Legal Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Engr. Juan Dela Cruz"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Corporate Email</label>
                    <input
                      type="email"
                      placeholder="e.g. juan.delacruz@fieldops.ph"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Mobile Contact</label>
                    <input
                      type="text"
                      value={signupPhone}
                      onChange={(e) => setSignupPhone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Primary Certification</label>
                    <input
                      type="text"
                      value={signupCert}
                      onChange={(e) => setSignupCert(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                    />
                  </div>
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
                  className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold font-mono rounded-xl shadow-lg shadow-emerald-950 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="animate-spin text-xs">Registering Account...</span>
                  ) : (
                    <>
                      <span>Complete Signup & Start {selectedRole === 'PROJECT_MANAGER' ? 'TSSR Upload' : 'Dashboard'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              Need assistance? Contact the <span className="text-cyan-400 font-mono">FieldOps Administrator</span>.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
