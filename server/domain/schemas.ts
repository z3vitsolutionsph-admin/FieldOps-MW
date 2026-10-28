import { z } from 'zod';

export const idSchema = z
  .string()
  .regex(/^[A-Za-z0-9_.:-]{1,128}$/, 'Must be 1–128 characters consisting of [A-Za-z0-9_.:-]');

export const dateSchema = z.string().refine((val) => !isNaN(Date.parse(val)), {
  message: 'Must be a valid ISO date or timestamp (e.g., 2026-10-11 or 2026-10-11T08:00:00Z)',
});

export const createWorkOrderSchema = z
  .object({
    workOrderNumber: z.string().min(1, 'workOrderNumber is required'),
    type: z.enum(['INSTALLATION', 'DISMANTLING', 'TROUBLESHOOTING']),
    siteId: idSchema,
    siteRole: z.enum(['A', 'B']).optional(),
    hopId: idSchema.optional(),
    projectId: idSchema.optional(),
    regionId: idSchema.optional(),
    scheduledDate: dateSchema.optional(),
    assigneeIds: z.array(idSchema).max(50, 'Max 50 assignee IDs allowed').optional(),
    tssrSnapshotVersion: z.string().optional(),
    milestonePhase: z.string().optional(),
  })
  .strict();

export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;

export const patchWorkOrderSchema = z
  .object({
    expectedVersion: z.number().int().positive().optional(),
    currentStepIndex: z.number().int().min(0).optional(),
    stepsData: z.record(z.string(), z.any()).optional(),
    milestonePhase: z.string().optional(),
    scheduledDate: dateSchema.optional(),
    assigneeIds: z.array(idSchema).max(50, 'Max 50 assignee IDs allowed').optional(),
    reviewerRemarks: z.string().optional(),
  })
  .strict();

export type PatchWorkOrderInput = z.infer<typeof patchWorkOrderSchema>;

export const transitionWorkOrderSchema = z
  .object({
    newStatus: z.enum([
      'DRAFT',
      'ASSIGNED',
      'SCHEDULED',
      'IN_PROGRESS',
      'PENDING_REVIEW',
      'APPROVED',
      'REJECTED',
      'CLOSED',
    ]),
    reason: z.string().optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();

export type TransitionWorkOrderInput = z.infer<typeof transitionWorkOrderSchema>;
