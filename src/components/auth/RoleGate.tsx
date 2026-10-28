import React from 'react';
import { ShieldAlert, Lock, ArrowLeft } from 'lucide-react';
import { UserProfile, UserRole } from '../../types/fieldops';
import { Permission, hasPermission, hasAllPermissions, isRoleAllowed } from '../../services/rbacService';

interface RoleGateProps {
  currentUser: UserProfile;
  allowedRoles?: UserRole[];
  requiredPermission?: Permission;
  requiredPermissions?: Permission[];
  fallback?: React.ReactNode;
  hideIfDenied?: boolean;
  children: React.ReactNode;
  sectionName?: string;
  onNavigateBack?: () => void;
}

export const RoleGate: React.FC<RoleGateProps> = ({
  currentUser,
  allowedRoles,
  requiredPermission,
  requiredPermissions,
  fallback,
  hideIfDenied = false,
  children,
  sectionName = 'Restricted Operation',
  onNavigateBack,
}) => {
  let isAuthorized = true;

  // 1. Role-based check
  if (allowedRoles && allowedRoles.length > 0) {
    if (!isRoleAllowed(currentUser.role, allowedRoles)) {
      isAuthorized = false;
    }
  }

  // 2. Single permission check
  if (isAuthorized && requiredPermission) {
    if (!hasPermission(currentUser.role, requiredPermission)) {
      isAuthorized = false;
    }
  }

  // 3. Multiple permissions check
  if (isAuthorized && requiredPermissions && requiredPermissions.length > 0) {
    if (!hasAllPermissions(currentUser.role, requiredPermissions)) {
      isAuthorized = false;
    }
  }

  if (isAuthorized) {
    return <>{children}</>;
  }

  // If denied and silent mode requested
  if (hideIfDenied) {
    return null;
  }

  // Custom fallback if provided
  if (fallback) {
    return <>{fallback}</>;
  }

  // Standard Telecom RBAC Access Denied Card
  const formattedRole = currentUser.role.replace('_', ' ');
  const requiredRolesText = allowedRoles
    ? allowedRoles.map((r) => r.replace('_', ' ')).join(', ')
    : requiredPermission || 'Elevated Privilege';

  return (
    <div className="p-6 sm:p-8 rounded-2xl bg-slate-900 border border-rose-900/50 shadow-xl max-w-xl mx-auto my-6 text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
        <Lock className="w-7 h-7" />
      </div>

      <div className="space-y-1">
        <span className="text-xs font-mono uppercase tracking-widest text-rose-400 font-bold">
          SECURITY ACCESS RESTRICTION · RBAC GATEWAY
        </span>
        <h3 className="text-base sm:text-lg font-bold text-white">
          Access Restricted: {sectionName}
        </h3>
        <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
          Your current active profile is assigned the <strong className="text-cyan-400">{formattedRole}</strong> role.
          This section is safety-gated and restricted to: <strong className="text-white">{requiredRolesText}</strong>.
        </p>
      </div>

      <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-left max-w-md mx-auto space-y-1">
        <div className="flex justify-between text-slate-400">
          <span>Active User:</span>
          <span className="text-slate-200">{currentUser.name}</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Role Policy:</span>
          <span className="text-rose-400 font-bold">{currentUser.role}</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Required Clearance:</span>
          <span className="text-emerald-400">{requiredRolesText}</span>
        </div>
      </div>

      {onNavigateBack && (
        <button
          onClick={onNavigateBack}
          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 mx-auto transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Return to My Assigned Jobs
        </button>
      )}
    </div>
  );
};
