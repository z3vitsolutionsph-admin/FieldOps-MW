import { z } from 'zod';

// Ids become Firestore document ids: keep them short and free of path separators.
export const Id = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_.:-]+$/, 'Invalid identifier');
const ShortText = z.string().trim().max(200);
// Accepts both calendar dates ("2026-10-11") and full ISO timestamps, as the client stores either.
const IsoDate = z
  .string()
  .max(40)
  .refine((s) => /^\d{4}-\d{2}-\d{2}/.test(s) && !Number.isNaN(Date.parse(s)), 'Expected an ISO date');

export const WorkOrderStatus = z.enum([
  'DRAFT',
  'ASSIGNED',
  'SCHEDULED',
  'IN_PROGRESS',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'CLOSED',
]);
export const WorkOrderType = z.enum(['INSTALLATION', 'DISMANTLING', 'TROUBLESHOOTING']);
const MilestonePhase = z.enum(['PHASE_1_CIVIL', 'PHASE_2_RIGGING', 'PHASE_3_COMMISSIONING', 'PHASE_4_QA_HANDOVER']);

const StepData = z.object({
  stepIndex: z.number().int().min(0).max(100),
  completed: z.boolean(),
  completedAt: z.string().optional(),
  completedBy: z.string().max(128).optional(),
  data: z.record(z.string(), z.unknown()),
  notes: z.string().max(5000).optional(),
});
const StepsData = z.record(z.string().regex(/^\d{1,3}$/), StepData);

export const WorkOrderListQuery = z.object({
  type: WorkOrderType.optional(),
  status: WorkOrderStatus.optional(),
  siteRole: z.enum(['A', 'B']).optional(),
  assigneeId: Id.optional(),
});

export const CreateWorkOrderBody = z
  .object({
    id: Id.optional(),
    workOrderNumber: z.string().trim().min(1).max(64),
    type: WorkOrderType,
    siteId: Id,
    siteRole: z.enum(['A', 'B']).default('B'),
    hopId: Id.optional(),
    projectId: ShortText.optional(),
    regionId: ShortText.optional(),
    scheduledDate: IsoDate.optional(),
    assigneeIds: z.array(Id).max(50).default([]),
    tssrSnapshotVersion: ShortText.optional(),
    milestonePhase: MilestonePhase.optional(),
  })
  .strict();

/** Status is deliberately absent: it changes only through the transition endpoint. */
export const UpdateWorkOrderBody = z
  .object({
    expectedVersion: z.number().int().min(0).optional(),
    currentStepIndex: z.number().int().min(0).max(100).optional(),
    stepsData: StepsData.optional(),
    milestonePhase: MilestonePhase.optional(),
    scheduledDate: IsoDate.optional(),
    assigneeIds: z.array(Id).max(50).optional(),
    reviewerRemarks: z.string().max(5000).optional(),
  })
  .strict();

export const TransitionBody = z
  .object({
    newStatus: WorkOrderStatus,
    reason: z.string().trim().max(1000).optional(),
    expectedVersion: z.number().int().min(0).optional(),
  })
  .strict();

export const InventoryVerifyBody = z
  .object({
    barcode: z.string().trim().max(128).optional(),
    assetTag: z.string().trim().max(128).optional(),
    serialNumber: z.string().trim().max(128).optional(),
  })
  .refine((b) => Boolean(b.barcode || b.assetTag || b.serialNumber), 'Barcode or asset tag query is required');

export const SyncCollection = z.enum(['work_orders', 'photos', 'tssr_approvals', 'inventory', 'tickets', 'audit_logs']);

export const SyncBatchBody = z.object({
  mutations: z
    .array(
      z.object({
        id: z.string().min(1).max(128),
        collectionName: SyncCollection,
        entityId: Id,
        operation: z.enum(['CREATE', 'UPDATE', 'DELETE']),
        payload: z.record(z.string(), z.unknown()).nullish(),
        baseVersion: z.number().int().min(0).optional(),
      })
    )
    .max(200),
});

const AiContext = z
  .object({
    siteId: ShortText.optional(),
    siteName: ShortText.optional(),
    hopName: ShortText.optional(),
  })
  .optional();

export const AiAskBody = z.object({ query: z.string().trim().min(1).max(2000), context: AiContext });

export const AiInspectPhotoBody = z.object({
  photoTitle: ShortText.min(1),
  // ~4.5 MB of base64 ≈ a 3.4 MB JPEG — plenty for QA, bounded for cost.
  imageBase64: z.string().min(16).max(6_000_000),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']).default('image/jpeg'),
});

export const AiAsBuiltBody = z.object({
  workOrderNumber: ShortText.min(1),
  siteId: ShortText,
  siteName: ShortText.optional(),
  hopName: ShortText.optional(),
  approvedAclHeightM: z.number().optional(),
  approvedAclLeg: ShortText.optional(),
  expectedRslDbm: z.number().optional(),
  stepsData: z.unknown().optional(),
});

export const AiParseTssrBody = z.object({
  rawText: z.string().min(20).max(50_000),
  fileName: z.string().trim().max(255).default('TSSR_DOCUMENT.pdf'),
});
