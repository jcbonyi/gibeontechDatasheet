import type { AuthUser } from '@/lib/auth';
import type { DatasheetStatus, UserRole } from '@/types/datasheet';
import {
  ASSESSOR_EDITABLE_STATUSES,
  getAvailableTransitions,
  isOpenStatus,
  isTerminalStatus,
  normalizeStatus,
  STATUS_LABELS,
  type StatusAction,
} from '@/lib/status';

export const ROLE_LABELS: Record<UserRole, string> = {
  Admin: 'Admin',
  PrincipalOfficer: 'Principal Officer',
  OperationsManager: 'Operations Manager',
  Assessor: 'Assessor',
};

const ROLE_RANK: Record<UserRole, number> = {
  Admin: 4,
  PrincipalOfficer: 3,
  OperationsManager: 2,
  Assessor: 1,
};

export interface DatasheetRecord {
  id?: number;
  created_by: number | null;
  assigned_to: number | null;
  status: DatasheetStatus | string;
}

export function isSuperUser(role: UserRole): boolean {
  return role === 'Admin';
}

export function canViewAllDatasheets(role: UserRole): boolean {
  return role !== 'Assessor';
}

export function canViewDatasheet(user: AuthUser, ds: DatasheetRecord): boolean {
  if (canViewAllDatasheets(user.role)) return true;
  return ds.created_by === user.id || ds.assigned_to === user.id;
}

export function canEditDatasheet(user: AuthUser, ds: DatasheetRecord): boolean {
  const status = normalizeStatus(ds.status);

  if (isSuperUser(user.role) || user.role === 'PrincipalOfficer') {
    return status !== 'closed' && status !== 'cancelled' && status !== 'report_issued';
  }

  if (user.role === 'OperationsManager') {
    return !isTerminalStatus(status);
  }

  if (user.role === 'Assessor') {
    const involved = ds.created_by === user.id || ds.assigned_to === user.id;
    return involved && ASSESSOR_EDITABLE_STATUSES.includes(status);
  }

  return false;
}

export function canDeleteDatasheet(user: AuthUser): boolean {
  return isSuperUser(user.role);
}

export function canAssignDatasheet(user: AuthUser): boolean {
  return user.role === 'Admin' || user.role === 'PrincipalOfficer' || user.role === 'OperationsManager';
}

export function canManageUsers(user: AuthUser): boolean {
  return canAssignDatasheet(user);
}

export function canReopenDatasheet(user: AuthUser): boolean {
  return user.role === 'Admin' || user.role === 'PrincipalOfficer' || user.role === 'OperationsManager';
}

export function canReviewDatasheet(user: AuthUser): boolean {
  return user.role === 'Admin' || user.role === 'PrincipalOfficer' || user.role === 'OperationsManager';
}

export function canIssueReport(user: AuthUser): boolean {
  return user.role === 'Admin' || user.role === 'PrincipalOfficer';
}

/** @deprecated Use canIssueReport */
export function canApproveDatasheet(user: AuthUser): boolean {
  return canIssueReport(user);
}

export function canDuplicateDatasheet(user: AuthUser): boolean {
  return true;
}

export function canTransitionStatus(
  user: AuthUser,
  ds: DatasheetRecord,
  next: DatasheetStatus,
): boolean {
  const from = normalizeStatus(ds.status);
  const to = normalizeStatus(next);
  if (!getAvailableTransitions(from).includes(to)) return false;

  if (to === 'report_issued' || to === 'closed') {
    return canIssueReport(user) || (to === 'closed' && canReviewDatasheet(user) && from === 'report_issued');
  }
  if (to === 'cancelled') {
    return canReviewDatasheet(user);
  }
  if (to === 'under_review' || to === 'pending_review') {
    if (user.role === 'Assessor' && to === 'pending_review') {
      return canEditDatasheet(user, ds) || ASSESSOR_EDITABLE_STATUSES.includes(from);
    }
    return canReviewDatasheet(user) || (user.role === 'Assessor' && to === 'pending_review');
  }
  if (user.role === 'Assessor') {
    const assessorAllowed: DatasheetStatus[] = [
      'in_progress',
      'awaiting_documents',
      'pending_review',
    ];
    return assessorAllowed.includes(to) && (ds.created_by === user.id || ds.assigned_to === user.id);
  }
  return canReviewDatasheet(user) || canAssignDatasheet(user);
}

export function getWorkflowActions(user: AuthUser, ds: DatasheetRecord): StatusAction[] {
  const from = normalizeStatus(ds.status);
  const next = getAvailableTransitions(from);
  const actions: StatusAction[] = [];

  for (const status of next) {
    if (!canTransitionStatus(user, ds, status)) continue;
    let variant: StatusAction['variant'] = 'secondary';
    if (status === 'report_issued' || status === 'pending_review') variant = 'primary';
    if (status === 'cancelled') variant = 'danger';
    actions.push({
      status,
      label: STATUS_LABELS[status],
      roles: [user.role],
      variant,
    });
  }

  return actions;
}

export function creatableRoles(actorRole: UserRole): UserRole[] {
  if (actorRole === 'Admin') {
    return ['Admin', 'PrincipalOfficer', 'OperationsManager', 'Assessor'];
  }
  if (actorRole === 'PrincipalOfficer') {
    return ['PrincipalOfficer', 'OperationsManager', 'Assessor'];
  }
  if (actorRole === 'OperationsManager') {
    return ['Assessor'];
  }
  return [];
}

export function canManageTargetUser(actor: AuthUser, targetRole: UserRole): boolean {
  if (!canManageUsers(actor)) return false;
  // Admin can manage every account (role changes, passwords, activation).
  if (actor.role === 'Admin') return true;
  if (isSuperUser(targetRole) && !isSuperUser(actor.role)) return false;
  return ROLE_RANK[actor.role] > ROLE_RANK[targetRole];
}

export function canAssignRole(actorRole: UserRole, newRole: UserRole): boolean {
  return creatableRoles(actorRole).includes(newRole);
}

export function getDatasheetPermissions(user: AuthUser, ds: DatasheetRecord) {
  const status = normalizeStatus(ds.status);
  return {
    canView: canViewDatasheet(user, ds),
    canEdit: canEditDatasheet(user, ds),
    canDelete: canDeleteDatasheet(user),
    canAssign:
      canAssignDatasheet(user) && (isSuperUser(user.role) || isOpenStatus(status)),
    canReopen: canReopenDatasheet(user) && (isTerminalStatus(status) || status === 'report_issued' || status === 'on_hold'),
    canMarkUnderReview: canReviewDatasheet(user) && status === 'pending_review',
    canApprove: canIssueReport(user) && (status === 'pending_review' || status === 'under_review'),
    canIssueReport: canIssueReport(user) && (status === 'pending_review' || status === 'under_review'),
    canDuplicate: canViewDatasheet(user, ds),
    workflowActions: getWorkflowActions(user, { ...ds, status }),
  };
}
