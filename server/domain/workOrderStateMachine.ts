import { WorkOrder, WorkOrderStatus } from '../../src/types/fieldops';
import { AuthUser } from '../auth';
import { hasPermission } from '../../src/services/rbacService';
import { forbidden, unprocessable } from '../http';

export interface TransitionContext {
  newStatus: WorkOrderStatus;
  user: AuthUser;
  reason?: string;
}

export function validateAndApplyTransition(wo: WorkOrder, ctx: TransitionContext): WorkOrder {
  const current = wo.status;
  const target = ctx.newStatus;
  const user = ctx.user;
  const isAssignee = Array.isArray(wo.assigneeIds) && wo.assigneeIds.includes(user.uid);
  const canAssign = hasPermission(user.role, 'ASSIGN_WORK_ORDERS');
  const canApprove = hasPermission(user.role, 'APPROVE_WORK_ORDER');
  const canReject = hasPermission(user.role, 'REJECT_WORK_ORDER');

  const nowIso = new Date().toISOString();

  // Validate state-machine moves and permissions
  switch (current) {
    case 'DRAFT': {
      if (target !== 'ASSIGNED') {
        throw unprocessable(`Invalid transition from DRAFT to ${target}. Allowed: ASSIGNED`);
      }
      if (!canAssign) {
        throw forbidden("Permission 'ASSIGN_WORK_ORDERS' required to transition DRAFT to ASSIGNED");
      }
      break;
    }

    case 'ASSIGNED': {
      if (target === 'SCHEDULED') {
        if (!canAssign) {
          throw forbidden("Permission 'ASSIGN_WORK_ORDERS' required to transition ASSIGNED to SCHEDULED");
        }
      } else if (target === 'IN_PROGRESS') {
        if (!isAssignee && !canAssign) {
          throw forbidden("Must be an assigned technician or have 'ASSIGN_WORK_ORDERS' to start work order");
        }
      } else {
        throw unprocessable(`Invalid transition from ASSIGNED to ${target}. Allowed: SCHEDULED, IN_PROGRESS`);
      }
      break;
    }

    case 'SCHEDULED': {
      if (target !== 'IN_PROGRESS') {
        throw unprocessable(`Invalid transition from SCHEDULED to ${target}. Allowed: IN_PROGRESS`);
      }
      if (!isAssignee && !canAssign) {
        throw forbidden("Must be an assigned technician or have 'ASSIGN_WORK_ORDERS' to start work order");
      }
      break;
    }

    case 'IN_PROGRESS': {
      if (target === 'PENDING_REVIEW') {
        if (!isAssignee && !canAssign) {
          throw forbidden("Must be an assigned technician or have 'ASSIGN_WORK_ORDERS' to submit for review");
        }
      } else if (target === 'REJECTED') {
        if (!canReject) {
          throw forbidden("Permission 'REJECT_WORK_ORDER' required to reject work order");
        }
        if (!ctx.reason || !ctx.reason.trim()) {
          throw unprocessable('A valid reason is strictly required when rejecting a work order');
        }
      } else {
        throw unprocessable(`Invalid transition from IN_PROGRESS to ${target}. Allowed: PENDING_REVIEW, REJECTED`);
      }
      break;
    }

    case 'PENDING_REVIEW': {
      if (target === 'APPROVED') {
        if (!canApprove) {
          throw forbidden("Permission 'APPROVE_WORK_ORDER' required to approve work order");
        }
      } else if (target === 'REJECTED') {
        if (!canReject) {
          throw forbidden("Permission 'REJECT_WORK_ORDER' required to reject work order");
        }
        if (!ctx.reason || !ctx.reason.trim()) {
          throw unprocessable('A valid reason is strictly required when rejecting a work order');
        }
      } else {
        throw unprocessable(`Invalid transition from PENDING_REVIEW to ${target}. Allowed: APPROVED, REJECTED`);
      }
      break;
    }

    case 'APPROVED': {
      if (target !== 'CLOSED') {
        throw unprocessable(`Invalid transition from APPROVED to ${target}. Allowed: CLOSED`);
      }
      if (!canApprove) {
        throw forbidden("Permission 'APPROVE_WORK_ORDER' required to close approved work order");
      }
      break;
    }

    case 'REJECTED': {
      if (target !== 'IN_PROGRESS') {
        throw unprocessable(`Invalid transition from REJECTED to ${target}. Allowed: IN_PROGRESS`);
      }
      if (!isAssignee && !canAssign) {
        throw forbidden("Must be an assigned technician or have 'ASSIGN_WORK_ORDERS' to resume rejected work order");
      }
      break;
    }

    case 'CLOSED': {
      throw unprocessable('Work order is CLOSED and cannot be transitioned to any other state');
    }

    default:
      throw unprocessable(`Unknown current status '${current}'`);
  }

  // Apply side-effects
  const updated: WorkOrder = {
    ...wo,
    status: target,
    updatedAt: nowIso,
  };

  if (target === 'IN_PROGRESS' && !updated.startedAt) {
    updated.startedAt = nowIso;
  } else if (target === 'PENDING_REVIEW') {
    updated.completedAt = nowIso;
  } else if (target === 'APPROVED') {
    updated.approvedAt = nowIso;
    updated.approvedBy = user.uid;
  } else if (target === 'REJECTED') {
    updated.reviewerRemarks = ctx.reason;
  }

  const historyEntry = {
    timestamp: nowIso,
    userId: user.uid,
    userName: user.name,
    action: `STATUS_CHANGE_${target}`,
    note: ctx.reason ? `Reason: ${ctx.reason}` : `Transitioned from ${current} to ${target}`,
  };

  updated.history = [...(wo.history || []), historyEntry];

  return updated;
}
