import { UserRole } from '../types/fieldops';

export type Permission =
  // Project Manager Privileges
  | 'VIEW_ALL_WORK_ORDERS'         // Project Manager, Admin: Oversee project schedules
  | 'ASSIGN_WORK_ORDERS'           // Project Manager, Admin: Assign Work Orders (Team Leader)
  | 'EXPORT_OFFICIAL_REPORTS'      // Project Manager, Reviewer, Admin: PDF report generation
  | 'MILESTONE_TRACKING'           // Project Manager, Admin: Milestone tracking
  | 'COST_SCHEDULE_AUDITS'         // Project Manager, Admin: Cost & schedule audits
  | 'UPLOAD_TSSR'                  // Project Manager: Upload TSSR and project parameter extraction
  | 'CREATE_WORK_ORDER'            // Project Manager, Admin
  | 'EDIT_WORK_ORDER_SETTINGS'     // Project Manager, Admin
  | 'VIEW_AUDIT_LOGS'              // Project Manager, Reviewer, Admin
  | 'OVERRIDE_GEOFENCE'            // Project Manager, Team Leader, Admin

  // Team Leader Privileges
  | 'QR_INVENTORY_SCAN'            // Team Leader, Technician: QR/Barcode inventory scan
  | 'BATTERY_TELEMETRY'            // Team Leader, Climber, Tech: Battery discharge telemetry
  | 'FIELD_DATA_LOGGING'           // Team Leader, Technician: Field data logging
  | 'APPROVE_PRE_CLIMB_CHECKLISTS' // Team Leader, Supervisor: Approve pre-climb safety checklists
  | 'INCIDENT_HAZARD_LOGGING'      // Team Leader, Supervisor: Incident & hazard logging
  | 'CREW_SAFETY_OVERSIGHT'        // Team Leader, Supervisor: Crew safety oversight
  | 'PHOTO_CAPTURE_UPLOAD'         // Team Leader, Climber, Tech: Photo capture & upload
  | 'MANDATORY_PRE_CLIMB_CHECK'    // Team Leader, Climber: Mandatory pre-climb check
  | 'HEIGHT_RIGGING_EXECUTION'     // Team Leader, Climber: Height & rigging execution
  | 'EXECUTE_TOWER_CLIMB'          // Team Leader, Climber: Tower climb execution
  | 'EXECUTE_INSTALLATION'         // Team Leader, Tech, Climber: Ground/tower installation
  | 'EXECUTE_DISMANTLE'            // Team Leader, Tech: Dismantling legacy links
  | 'RESOLVE_TROUBLE_TICKET'       // Team Leader, Tech: Trouble ticket diagnosis

  // Reviewer & Admin Privileges
  | 'APPROVE_WORK_ORDER'           // Reviewer, Admin
  | 'REJECT_WORK_ORDER'            // Reviewer, Admin
  | 'SIGN_TSSR_ROUTING'            // Reviewer, Admin
  | 'MANAGE_USERS_ROLES'           // Admin
  | 'SIGN_SAFETY_GATE'             // Team Leader, Supervisor, Admin
  | 'SIGN_CHAIN_OF_CUSTODY'        // Team Leader, Tech, Supervisor
  | 'MANAGE_INVENTORY_LEDGER';     // Project Manager, Admin

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  PROJECT_MANAGER: [
    'VIEW_ALL_WORK_ORDERS',
    'ASSIGN_WORK_ORDERS',
    'EXPORT_OFFICIAL_REPORTS',
    'MILESTONE_TRACKING',
    'COST_SCHEDULE_AUDITS',
    'UPLOAD_TSSR',
    'CREATE_WORK_ORDER',
    'EDIT_WORK_ORDER_SETTINGS',
    'VIEW_AUDIT_LOGS',
    'MANAGE_INVENTORY_LEDGER',
    'OVERRIDE_GEOFENCE',
  ],

  TEAM_LEADER: [
    'QR_INVENTORY_SCAN',
    'BATTERY_TELEMETRY',
    'FIELD_DATA_LOGGING',
    'APPROVE_PRE_CLIMB_CHECKLISTS',
    'INCIDENT_HAZARD_LOGGING',
    'CREW_SAFETY_OVERSIGHT',
    'PHOTO_CAPTURE_UPLOAD',
    'MANDATORY_PRE_CLIMB_CHECK',
    'HEIGHT_RIGGING_EXECUTION',
    'EXECUTE_TOWER_CLIMB',
    'EXECUTE_INSTALLATION',
    'EXECUTE_DISMANTLE',
    'RESOLVE_TROUBLE_TICKET',
    'SIGN_SAFETY_GATE',
    'SIGN_CHAIN_OF_CUSTODY',
    'OVERRIDE_GEOFENCE',
  ],

  ADMIN: [
    'VIEW_ALL_WORK_ORDERS',
    'ASSIGN_WORK_ORDERS',
    'EXPORT_OFFICIAL_REPORTS',
    'MILESTONE_TRACKING',
    'COST_SCHEDULE_AUDITS',
    'UPLOAD_TSSR',
    'CREATE_WORK_ORDER',
    'EDIT_WORK_ORDER_SETTINGS',
    'QR_INVENTORY_SCAN',
    'BATTERY_TELEMETRY',
    'FIELD_DATA_LOGGING',
    'APPROVE_PRE_CLIMB_CHECKLISTS',
    'INCIDENT_HAZARD_LOGGING',
    'CREW_SAFETY_OVERSIGHT',
    'PHOTO_CAPTURE_UPLOAD',
    'MANDATORY_PRE_CLIMB_CHECK',
    'HEIGHT_RIGGING_EXECUTION',
    'EXECUTE_TOWER_CLIMB',
    'EXECUTE_INSTALLATION',
    'EXECUTE_DISMANTLE',
    'RESOLVE_TROUBLE_TICKET',
    'APPROVE_WORK_ORDER',
    'REJECT_WORK_ORDER',
    'SIGN_TSSR_ROUTING',
    'MANAGE_USERS_ROLES',
    'VIEW_AUDIT_LOGS',
    'SIGN_SAFETY_GATE',
    'SIGN_CHAIN_OF_CUSTODY',
    'MANAGE_INVENTORY_LEDGER',
    'OVERRIDE_GEOFENCE',
  ],

  SUPERVISOR: [
    'VIEW_ALL_WORK_ORDERS',
    'APPROVE_PRE_CLIMB_CHECKLISTS',
    'INCIDENT_HAZARD_LOGGING',
    'CREW_SAFETY_OVERSIGHT',
    'EXECUTE_INSTALLATION',
    'HEIGHT_RIGGING_EXECUTION',
    'EXECUTE_TOWER_CLIMB',
    'SIGN_SAFETY_GATE',
    'EXECUTE_DISMANTLE',
    'SIGN_CHAIN_OF_CUSTODY',
    'RESOLVE_TROUBLE_TICKET',
    'OVERRIDE_GEOFENCE',
    'EXPORT_OFFICIAL_REPORTS',
    'BATTERY_TELEMETRY',
    'PHOTO_CAPTURE_UPLOAD',
  ],

  REVIEWER: [
    'VIEW_ALL_WORK_ORDERS',
    'APPROVE_WORK_ORDER',
    'REJECT_WORK_ORDER',
    'SIGN_TSSR_ROUTING',
    'VIEW_AUDIT_LOGS',
    'MANAGE_INVENTORY_LEDGER',
    'RESOLVE_TROUBLE_TICKET',
    'EXPORT_OFFICIAL_REPORTS',
  ],

  TECHNICIAN: [
    'QR_INVENTORY_SCAN',
    'BATTERY_TELEMETRY',
    'FIELD_DATA_LOGGING',
    'PHOTO_CAPTURE_UPLOAD',
    'EXECUTE_INSTALLATION',
    'EXECUTE_DISMANTLE',
    'SIGN_CHAIN_OF_CUSTODY',
    'RESOLVE_TROUBLE_TICKET',
    'EXPORT_OFFICIAL_REPORTS',
  ],

  TOWER_CLIMBER: [
    'BATTERY_TELEMETRY',
    'PHOTO_CAPTURE_UPLOAD',
    'MANDATORY_PRE_CLIMB_CHECK',
    'HEIGHT_RIGGING_EXECUTION',
    'EXECUTE_TOWER_CLIMB',
    'EXECUTE_INSTALLATION',
  ],
};

export const hasPermission = (role: UserRole, permission: Permission): boolean => {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
};

export const hasAnyPermission = (role: UserRole, permissions: Permission[]): boolean => {
  return permissions.some((perm) => hasPermission(role, perm));
};

export const hasAllPermissions = (role: UserRole, permissions: Permission[]): boolean => {
  return permissions.every((perm) => hasPermission(role, perm));
};

export const isRoleAllowed = (role: UserRole, allowedRoles: UserRole[]): boolean => {
  return allowedRoles.includes(role);
};
