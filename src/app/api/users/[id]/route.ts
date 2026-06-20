import { NextRequest, NextResponse } from 'next/server';
import { query, updateUserRecord } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { badRequest, forbidden, getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import {
  canAssignRole,
  canManageUsers,
  canManageTargetUser,
  isSuperUser,
} from '@/lib/permissions';
import { USER_ROLES, type UserRole } from '@/types/datasheet';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await getAuthUser(req);
    if (!actor) return unauthorized();
    if (!canManageUsers(actor)) return forbidden();

    const { id } = await params;
    const targetId = Number(id);
    const targetResult = await query<{
      id: number;
      name: string;
      email: string;
      role: UserRole;
      is_active: boolean;
    }>('SELECT id, name, email, role, is_active FROM users WHERE id = $1', [targetId]);

    const target = targetResult.rows[0];
    if (!target) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }
    if (!canManageTargetUser(actor, target.role)) return forbidden();
    if (target.id === actor.id && isSuperUser(target.role) && !isSuperUser(actor.role)) {
      return forbidden();
    }

    const body = await req.json();
    const patch: {
      name?: string;
      email?: string;
      role?: UserRole;
      is_active?: boolean;
      password_hash?: string;
    } = {};

    if (body.name) patch.name = String(body.name).trim();
    if (body.email) patch.email = String(body.email).trim().toLowerCase();
    if (typeof body.is_active === 'boolean') patch.is_active = body.is_active;

    if (body.role) {
      const newRole = String(body.role) as UserRole;
      if (!USER_ROLES.includes(newRole) || !canAssignRole(actor.role, newRole)) {
        return forbidden();
      }
      if (isSuperUser(newRole) && !isSuperUser(actor.role)) {
        return forbidden();
      }
      patch.role = newRole;
    }

    if (body.password) {
      const password = String(body.password);
      if (password.length < 8) return badRequest('Password must be at least 8 characters');
      patch.password_hash = await hashPassword(password);
    }

    const updated = await updateUserRecord(targetId, patch);
    return NextResponse.json({ user: updated });
  } catch (err) {
    return handleRouteError(err, 'PATCH /api/users/[id]');
  }
}
