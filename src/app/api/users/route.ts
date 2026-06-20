import { NextRequest, NextResponse } from 'next/server';
import { query, updateUserRecord } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { badRequest, forbidden, getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import {
  canAssignRole,
  canManageUsers,
  canManageTargetUser,
  creatableRoles,
} from '@/lib/permissions';
import { ROLE_LABELS, USER_ROLES, type UserRole } from '@/types/datasheet';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (!canManageUsers(user)) return forbidden();

    const result = await query(
      'SELECT id, name, email, role, is_active, created_at FROM users ORDER BY name',
    );

    const allowedRoles = creatableRoles(user.role);
    const users = result.rows.map((row) => ({
      ...row,
      roleLabel: ROLE_LABELS[row.role as UserRole] || row.role,
      canManage: canManageTargetUser(user, row.role as UserRole),
    }));

    return NextResponse.json({ users, creatableRoles: allowedRoles, roleLabels: ROLE_LABELS });
  } catch (err) {
    return handleRouteError(err, 'GET /api/users');
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (!canManageUsers(user)) return forbidden();

    const body = await req.json();
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const role = String(body.role || 'Assessor') as UserRole;

    if (!name || !email || !password || password.length < 8) {
      return badRequest('Name, email, and password (min 8 chars) are required');
    }
    if (!USER_ROLES.includes(role)) {
      return badRequest('Invalid role');
    }
    if (!canAssignRole(user.role, role)) {
      return forbidden();
    }

    const passwordHash = await hashPassword(password);
    const result = await query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, is_active, created_at',
      [name, email, passwordHash, role],
    );

    return NextResponse.json({ user: result.rows[0] }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message.includes('duplicate key')) {
      return NextResponse.json({ message: 'Email already in use' }, { status: 409 });
    }
    return handleRouteError(err, 'POST /api/users');
  }
}
