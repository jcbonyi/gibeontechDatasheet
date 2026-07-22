import type { AuthUser } from '@/lib/auth';
import type { UserRole } from '@/types/datasheet';

/** Production module access mapped onto existing assessment roles. */
export function canAccessProduction(user: AuthUser | null | undefined): boolean {
  return Boolean(user);
}

/** Administrator / Manager: full register + reports + admin entities. */
export function canManageProduction(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  return (
    user.role === 'Admin' ||
    user.role === 'PrincipalOfficer' ||
    user.role === 'OperationsManager'
  );
}

export function canManageProductionAdmin(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'Admin' || user.role === 'PrincipalOfficer';
}

export function canDeleteProductionEntry(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'Admin' || user.role === 'PrincipalOfficer';
}

export function canEditAnyProductionEntry(user: AuthUser | null | undefined): boolean {
  return canManageProduction(user);
}

export function canEditProductionEntry(
  user: AuthUser | null | undefined,
  createdBy: number | null,
): boolean {
  if (!user) return false;
  if (canEditAnyProductionEntry(user)) return true;
  return createdBy === user.id;
}

export function productionRoleLabel(role: UserRole): string {
  if (role === 'Admin') return 'Administrator';
  if (role === 'PrincipalOfficer' || role === 'OperationsManager') return 'Manager';
  return 'Staff';
}
