import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword, requireRole } from '@/lib/auth';
import {
  badRequest,
  forbidden,
  getAuthUser,
  unauthorized,
} from '@/lib/api';
import { USER_ROLES } from '@/types/datasheet';

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (!requireRole(user, ['Admin'])) return forbidden();

  const result = await query(
    'SELECT id, name, email, role, is_active, created_at FROM users ORDER BY name ASC',
  );
  return NextResponse.json({ users: result.rows });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (!requireRole(user, ['Admin'])) return forbidden();

  const body = await req.json();
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const role = String(body.role || 'Assessor');

  if (!name || !email || !password || password.length < 8) {
    return badRequest('Name, email, and password (min 8 chars) are required');
  }
  if (!USER_ROLES.includes(role as (typeof USER_ROLES)[number])) {
    return badRequest('Invalid role');
  }

  try {
    const passwordHash = await hashPassword(password);
    const result = await query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, is_active, created_at',
      [name, email, passwordHash, role],
    );
    return NextResponse.json({ user: result.rows[0] }, { status: 201 });
  } catch {
    return badRequest('Email already exists');
  }
}
