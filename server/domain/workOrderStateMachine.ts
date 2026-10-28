import type { WorkOrder, WorkOrderStatus } from '../../src/types/fieldops';
import { hasPermission, type Permission } from '../../src/services/rbacService';
import type { AuthUser } from '../auth';

/**
 * Who may perform a transition:
 * - a permission the actor must hold, or
 * - 'ASSIGNEE': the actor is assigned to the work order (or can assign work orders).
 */
type Guard = Permission | 'ASSIGNEE';

interface TransitionRule {
  to: WorkOrderStatus;
  guard: Guard;
  requiresReason?: boolean;
}

export const TRANSITIONS: Record<WorkOrderStatus, TransitionRule[]> = {
  DRAFT: [{ to: 'ASSIGNED', guard: 'ASSIGN_WORK_ORDERS' }],
  ASSIGNED: [
    { to: 'SCHEDULED', guard: 'ASSIGN_WORK_ORDERS' },
    { to: 'IN_PROGRESS', guard: 'ASSIGNEE' },
  ],
  SCHEDULED: [{ to: 'IN_PROGRESS', guard: 'ASSIGNEE' }],
  IN_PROGRESS: [
    { to: 'PENDING_REVIEW', guard: 'ASSIGNEE' },
    { to: 'REJECTED', guard: 'REJECT_WORK_ORDER', requiresReason: true },
  ],
  PENDING_REVIEW: [
    { to: 'APPROVED', guard: 'APPROVE_WORK_ORDER' },
    { to: 'REJECTED', guard: 'REJECT_WORK_ORDER', requiresReason: true },
  ],
  APPROVED: [{ to: 'CLOSED', guard: 'APPROVE_WORK_ORDER' }],
  REJECTED: [{ to: 'IN_PROGRESS', guard: 'ASSIGNEE' }],
  CLOSED: [],
};

export function isAssignee(user: AuthUser, wo: Pick<WorkOrder, 'assigneeIds'>): boolean {
  return wo.assigneeIds.includes(user.uid);
}

/** Field crews see their own jobs; oversight roles see every job in their org. */
export function canViewWorkOrder(user: AuthUser, wo: Pick<WorkOrder, 'assigneeIds'>): boolean {
  return hasPermission(user.role, 'VIEW_ALL_WORK_ORDERS') || isAssignee(user, wo);
}

export type TransitionCheck =
  | { ok: true; rule: TransitionRule }
  | { ok: false; status: 403 | 422; message: string };

export function checkTransition(
  user: AuthUser,
  wo: Pick<WorkOrder, 'status' | 'assigneeIds'>,
  to: WorkOrderStatus,
  reason?: string
): TransitionCheck {
  const rules = TRANSITIONS[wo.status] ?? [];
  const rule = rules.find((r) => r.to === to);
  if (!rule) {
    const allowed = rules.map((r) => r.to).join(', ') || 'none';
    return { ok: false, status: 422, message: `Invalid transition from '${wo.status}' to '${to}'. Allowed: ${allowed}` };
  }
  const permitted =
    rule.guard === 'ASSIGNEE'
      ? isAssignee(user, wo) || hasPermission(user.role, 'ASSIGN_WORK_ORDERS')
      : hasPermission(user.role, rule.guard);
  if (!permitted) {
    return { ok: false, status: 403, message: `Role '${user.role}' may not move a work order to '${to}'` };
  }
  if (rule.requiresReason && !reason?.trim()) {
    return { ok: false, status: 422, message: `A reason is required to move a work order to '${to}'` };
  }
  return { ok: true, rule };
}

/** Timestamps and reviewer fields that accompany a status change. */
export function transitionSideEffects(user: AuthUser, to: WorkOrderStatus, now: string): Partial<WorkOrder> {
  switch (to) {
    case 'IN_PROGRESS':
      return { startedAt: now };
    case 'PENDING_REVIEW':
      return { completedAt: now };
    case 'APPROVED':
      return { approvedAt: now, approvedBy: user.uid };
    default:
      return {};
  }
}
