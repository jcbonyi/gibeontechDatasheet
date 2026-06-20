import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { AuthUser, getTokenFromRequest, verifyToken } from '@/lib/auth';

export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded) return null;

  const result = await query<{
    id: number;
    name: string;
    email: string;
    role: AuthUser['role'];
    is_active: boolean;
  }>('SELECT id, name, email, role, is_active FROM users WHERE id = $1', [decoded.id]);

  const user = result.rows[0];
  if (!user || !user.is_active) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.is_active,
  };
}

export function unauthorized() {
  return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
}

export function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}
