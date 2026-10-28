export type UserRole =
  | 'PROJECT_MANAGER'
  | 'TEAM_LEADER'
  | 'ADMIN'
  | 'REVIEWER'
  | 'SUPERVISOR'
  | 'TECHNICIAN'
  | 'TOWER_CLIMBER';

export type PlanTier = 'FREE' | 'TEAM' | 'ENTERPRISE';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  orgId: string;
  avatarUrl?: string;
  phone?: string;
  certifications?: string[]; // e.g. "Working at Heights - Level 2", "RF Safety"
  climberLicenseNo?: string;
  status?: 'AVAILABLE' | 'ON_DUTY' | 'REST_DAY' | 'IN_TRANSIT';
  yearsExperience?: number;
  specialization?: string;
}

export interface ParsedTssrProjectData {
  documentTitle: string;
  projectCode: string;
  uploadedAt: string;
  uploadedBy: string;
  hop: Hop;
  siteA: Site;
  siteB: Site;
  generatedWorkOrders: WorkOrder[];
  summary: {
    totalDistanceKm: number;
    requiredACLHeightM: number;
    targetRslDbm: number;
    frequencyGHz: number;
    totalMilestones: number;
  };
}

export interface Organization {
  id: string;
  name: string;
  tier: PlanTier;
  createdAt: string;
}

export type LinkType = 'NEW LINK' | 'CHANGE-OUT' | 'DISMANTLE';

export interface ModulationEntry {
  scheme: string; // e.g. "QPSK", "16QAM", "64QAM", "128QAM", "256QAM", "512QAM", "1024QAM", "2048QAM", "4096QAM"
  throughputMbps: number;
  rxThresholdDbm: number;
}

export interface Hop {
  id: string;
  orgId: string;
  projectId: string;
  regionId: string;
  hopName: string;
  siteAId: string;
  siteBId: string;
  linkType: LinkType;
  configuration: string; // e.g. "4+0 CA XPIC"
  pathLengthKm: number;
  frequencyMHz: number; // e.g. 11000
  subBand?: string;
  radioModel: string; // e.g. "G11H3DD2-3-B-AM-482M"
  idu: string; // e.g. "NR9150"
  antennaModel: string; // e.g. "MA12U10W 40.2 dBi"
  antennaSizeM: number; // e.g. 1.2
  expectedTxDbm: number; // e.g. 20
  expectedRslDbm: number; // e.g. -27.17
  freeSpaceLossDb: number; // e.g. 125.31
  thermalFadeMarginDb: number; // e.g. 26.83 at 4096QAM
  polarization: 'V' | 'H' | 'Dual';
  modulationTable: ModulationEntry[];
}

export interface AntennaLoad {
  id: string;
  leg: string; // e.g. "Leg C", "Leg A"
  direction: string;
  sizeM: number;
  heightM: number;
  azimuthDeg: number;
  status: 'EXISTING' | 'PROPOSED' | 'TO_DISMANTLE';
  remarks: string;
}

export interface CablePlan {
  mainPowerM: number;
  rdntPowerM: number;
  ifCableM: number;
  cpriCableM: number;
  focCableM: number;
  groundingIduM: number;
  groundingIduMm2: number;
  groundingLpaM: number;
  groundingLpaMm2: number;
  groundingOduM: number;
  groundingOduMm2: number;
  groundingEbandM?: number;
  busbarLocations: string[]; // e.g. ["40.3 m", "1.3 m", "ODC pad"]
}

export interface AccessRoad {
  available: boolean;
  type: 'CONCRETE' | 'GRAVEL' | 'DIRT' | 'NO_ROAD';
  distanceToMainRoadM: number;
  haulingMethod: 'VEHICLE' | 'MANUAL' | 'EXTREME_MANUAL' | 'BOAT';
  extremeHaulingMeters?: number;
}

export interface TowerInfo {
  isNew: boolean;
  type: string; // e.g. "3-legged SST tubular", "Guyed mast", "Monopole", "Greenfield (No structure)"
  steelType: string;
  heightM: number;
  cableTrayAvailable: boolean;
  spaceAvailable: boolean;
  groundingAvailable: boolean;
  legSizes: string; // e.g. "190 mm upper / 330 mm lower"
}

export interface PowerInfo {
  dcpdb: string;
  voltage: number; // -48
  breakerCapacityA: number;
  outdoorCabinetNeeded: boolean;
  rectifierBrand: string; // e.g. "ZTE ER4850"
  rectifierModulesCount: number; // 5
  rectifierModuleRatingA: number; // 50
  rectifierEnergized: boolean;
  batteryBrand: string; // e.g. "ZXESM R312"
  batteryAh: number; // 100
  batteryBanksCount: number; // 7
  gensetKva?: number;
}

export interface Site {
  id: string; // PLA ID e.g. "NS-TER25-A062", "NS-TER25-A035"
  orgId: string;
  name: string;
  role: 'A' | 'B';
  ownerTowerProvider: string; // e.g. "EDOTCO", "LDIC", "SBA", "SMART"
  ownerContact: string;
  siteType: 'ROOFTOP' | 'GREENFIELD' | 'ELEVATED_GREENFIELD';
  address: string;
  lat: number;
  long: number;
  latDms: string;
  longDms: string;
  elevationM: number;
  keyholder: string;
  keyholderContact: string;
  securityNotes: string;
  accessRoad: AccessRoad;
  commercialPower: {
    available: boolean;
    mcbConnected: boolean;
    remarks: string;
  };
  tower: TowerInfo;
  power: PowerInfo;
  antennaLoads: AntennaLoad[];
  cablePlan: CablePlan;
  approvedAclHeightM?: number; // approved Antenna Centerline height by Transport Eng
  approvedAclLeg?: string;
  approvedAclRemarks?: string;
}

export type WorkOrderStatus =
  | 'DRAFT'
  | 'ASSIGNED'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CLOSED';

export type WorkOrderType = 'INSTALLATION' | 'DISMANTLING' | 'TROUBLESHOOTING';

export interface InstallationStepData {
  stepIndex: number;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
  data: Record<string, any>;
  notes?: string;
}

export interface WorkOrder {
  id: string;
  orgId: string;
  workOrderNumber: string; // e.g. "WO-2026-CRANE-002"
  type: WorkOrderType;
  projectId: string;
  regionId: string;
  hopId: string;
  siteId: string;
  siteRole: 'A' | 'B';
  assigneeIds: string[];
  status: WorkOrderStatus;
  scheduledDate: string;
  startedAt?: string;
  completedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  reviewerRemarks?: string;
  tssrSnapshotVersion: string;
  currentStepIndex: number;
  stepsData: Record<number, InstallationStepData>;
  history: {
    timestamp: string;
    userId: string;
    userName: string;
    action: string;
    note?: string;
  }[];
  updatedAt?: string;
  /** Optimistic-concurrency counter, incremented by the server on every write. */
  version?: number;
  syncStatus?: 'SYNCED' | 'QUEUED' | 'ERROR';
  milestonePhase?: 'PHASE_1_CIVIL' | 'PHASE_2_RIGGING' | 'PHASE_3_COMMISSIONING' | 'PHASE_4_QA_HANDOVER';
  budgetCostPhp?: number;
  actualCostPhp?: number;
  estimatedHours?: number;
  actualHours?: number;
  teamLeaderId?: string;
  teamLeaderName?: string;
  preClimbSafetyApproved?: boolean;
  preClimbSafetyOfficer?: string;
  shiftHandovers?: ShiftHandoverLog[];
}

export interface HandoverToolItem {
  toolName: string;
  condition: 'OPERATIONAL' | 'NEEDS_INSPECTION' | 'DEPLETED' | 'MISSING';
  location: string;
}

export interface ShiftHandoverLog {
  id: string;
  workOrderId: string;
  workOrderNumber: string;
  siteId: string;
  siteRole: 'A' | 'B';
  timestamp: string;
  departingTechnicianId: string;
  departingTechnicianName: string;
  departingRole: UserRole;
  incomingShiftLeadName?: string;
  incomingShiftLeadRole?: UserRole;
  shiftType: 'DAY_SHIFT' | 'AFTERNOON_SHIFT' | 'NIGHT_SHIFT' | 'TOWER_CLIMB_ROTATION' | 'WEATHER_STANDBY';
  statusSummary: string;
  completedItems: string[];
  remainingTasks: string[];
  blockersOrHazards: string[];
  toolsHandover: HandoverToolItem[];
  batteryLevelAtHandover?: number;
  batteryHealthAtHandover?: string;
  weatherConditionAtHandover?: string;
  windSpeedKmhAtHandover?: number;
  departingSignature: string;
  incomingAcknowledgement?: {
    acknowledgedAt: string;
    technicianName: string;
    technicianRole: UserRole;
    notes?: string;
    signature: string;
  };
}

export interface PhotoEvidence {
  id: string;
  orgId: string;
  workOrderId?: string;
  siteId: string;
  sectionCode: string; // e.g. "1.1_ACCESS", "1.2_TOWER", "PANORAMA_090"
  sectionTitle: string;
  caption: string;
  dataUrl: string; // data URI or URL
  capturedAt: string;
  capturedBy: string;
  gpsLat?: number;
  gpsLong?: number;
  azimuthDeg?: number;
  isNa?: boolean;
  naReason?: string;
  aiVerification?: {
    verified: boolean;
    score: number;
    feedback: string;
  };
  syncStatus: 'SYNCED' | 'QUEUED' | 'ERROR';
}

export interface InventoryItem {
  id: string;
  orgId: string;
  workOrderId?: string;
  siteId: string;
  equipmentType: string; // "ODU", "IDU", "Antenna", "AMB", "Coupler", "Rectifier"
  model: string;
  serialNumber: string;
  assetTag: string;
  condition: 'GOOD' | 'DAMAGED' | 'MISSING';
  status: 'INSTALLED' | 'DISMANTLED_PENDING_RETURN' | 'RETURNED_TO_WAREHOUSE';
  photoBeforeUrl?: string;
  photoAfterUrl?: string;
  destinationWarehouse?: string;
  chainOfCustodySigner?: string;
  removalDate?: string;
  notes?: string;
  syncStatus?: 'SYNCED' | 'QUEUED' | 'ERROR';
}

export interface TroubleshootingTicket {
  id: string;
  orgId: string;
  ticketNumber: string;
  hopId: string;
  siteId: string;
  symptom: string; // "LINK_DOWN" | "LOW_RSL" | "HIGH_BER" | "FLAPPING" | "POWER_FAILURE" | "XPIC_DEGRADED" | "ALARM_ACTIVE"
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
  findings: string[];
  measurements: {
    measuredRslDbm?: number;
    voltageDc?: number;
    berValue?: string;
    temperatureC?: number;
  };
  rootCause: string;
  actionTaken: string;
  outcome: 'RESOLVED' | 'ESCALATED_NOC' | 'ESCALATED_VENDOR' | 'SPARE_REQUIRED';
  mttrMinutes: number;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';
  createdAt: string;
  resolvedAt?: string;
  assignedTechnician: string;
  syncStatus?: 'SYNCED' | 'QUEUED' | 'ERROR';
}

export interface TssrApprovalSheet {
  transportEng: {
    status: 'APPROVED' | 'REJECTED' | 'CONDITIONAL';
    approverName: string;
    date: string;
    aclApprovedM: number;
    legApproved: string;
    remarks: string;
  };
  facilityEng: {
    status: 'APPROVED' | 'REJECTED' | 'CONDITIONAL';
    approverName: string;
    date: string;
    powerApprovalRemarks: string;
  };
  towerAssessment: {
    status: 'APPROVED' | 'REJECTED' | 'CONDITIONAL';
    approverName: string;
    date: string;
    structuralCapacityRemarks: string;
  };
}

export interface OfflineQueueItem {
  id: string;
  action: 'SAVE_STEP' | 'UPLOAD_PHOTO' | 'CREATE_TICKET' | 'UPDATE_WO_STATUS' | 'SAVE_INVENTORY' | 'UPDATE_WORK_ORDER' | 'UPDATE_TSSR' | string;
  payload: any;
  timestamp: string;
  retryCount: number;
  error?: string;
}

export interface AuditLogItem {
  id: string;
  orgId: string;
  userId: string;
  userName: string;
  action: string;
  targetId: string;
  targetType: string;
  details: string;
  timestamp: string;
}

export interface BatteryTelemetryPoint {
  id: string;
  siteId: string;
  timestamp: string;
  timeLabel: string;
  hoursAgo: number;
  voltage: number; // e.g. -48.2 (DC Volts)
  dischargeCurrentA: number; // e.g. 16.5 (Amperes)
  stateOfChargePercent: number; // e.g. 84 (%)
  temperatureC: number; // e.g. 31.0 (°C)
  gridStatus: 'AC_NORMAL' | 'GRID_OUTAGE' | 'GENSET_ONLINE' | 'FLOAT_CHARGE';
  notes?: string;
}

export type DeviceBatteryAlertLevel = 'NOMINAL' | 'ADVISORY' | 'CRITICAL' | 'EMERGENCY';

export interface DeviceBatteryLogPoint {
  timestamp: number;
  timeStr: string;
  level: number; // 0 - 100%
  dischargeRatePerHour: number; // %/hr (negative when discharging)
  charging: boolean;
  temperatureC: number;
  alertLevel: DeviceBatteryAlertLevel;
}

export interface DeviceBatteryState {
  level: number; // 0 - 100%
  charging: boolean;
  chargingTime: number | null; // seconds until fully charged or null
  dischargingTime: number | null; // seconds until depleted or null
  dischargeRatePerHour: number; // calculated %/hr
  healthStatus: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
  batteryHealthScore: number; // 0 - 100%
  estimatedMinutesRemaining: number | null;
  temperatureC: number;
  alertLevel: DeviceBatteryAlertLevel;
  isSimulated: boolean;
  isSupported: boolean;
  warningThreshold: number; // default 25%
  criticalThreshold: number; // default 15%
  emergencyThreshold: number; // default 8%
}

export interface DeviceBatterySession {
  sessionId: string;
  startTime: string;
  startLevel: number;
  currentLevel: number;
  lowestLevel: number;
  averageDischargeRate: number;
  points: DeviceBatteryLogPoint[];
  alertsTriggered: number;
  status: 'ACTIVE' | 'SAVED' | 'ARCHIVED';
}

