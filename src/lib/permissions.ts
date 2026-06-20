import type { DatasheetStatus, UserRole } from '@/types/datasheet';
import type { AuthUser } from '@/lib/auth';

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
  status: DatasheetStatus;
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
  if (isSuperUser(user.role) || user.role === 'PrincipalOfficer') return true;

  if (user.role === 'OperationsManager') {
    return ds.status !== 'approved';
  }

  if (user.role === 'Assessor') {
    const involved = ds.created_by === user.id || ds.assigned_to === user.id;
    return involved && ds.status === 'draft';
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

export function canApproveDatasheet(user: AuthUser): boolean {
  return user.role === 'Admin' || user.role === 'PrincipalOfficer';
}

export function canDuplicateDatasheet(user: AuthUser): boolean {
  return true;
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
  if (actor.id && actor.role === targetRole && isSuperUser(targetRole)) {
    return isSuperUser(actor.role);
  }
  if (isSuperUser(targetRole) && !isSuperUser(actor.role)) return false;
  return ROLE_RANK[actor.role] > ROLE_RANK[targetRole];
}

export function canAssignRole(actorRole: UserRole, newRole: UserRole): boolean {
  return creatableRoles(actorRole).includes(newRole);
}

export function getDatasheetPermissions(user: AuthUser, ds: DatasheetRecord) {
  return {
    canView: canViewDatasheet(user, ds),
    canEdit: canEditDatasheet(user, ds),
    canDelete: canDeleteDatasheet(user),
    canAssign: canAssignDatasheet(user),
    canReopen: canReopenDatasheet(user) && ds.status !== 'draft',
    canMarkUnderReview: canReviewDatasheet(user) && ds.status === 'submitted',
    canApprove: canApproveDatasheet(user) && (ds.status === 'submitted' || ds.status === 'under_review'),
    canDuplicate: canViewDatasheet(user, ds),
  };
}
