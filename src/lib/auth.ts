import jwt, { type SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import type { DatasheetStatus, UserRole } from '@/types/datasheet';
import {
  canEditDatasheet as canEditDatasheetPerm,
  canViewDatasheet,
  type DatasheetRecord,
} from '@/lib/permissions';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const COOKIE_NAME = 'gibeontech_datasheet_token';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn'] },
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(req: NextRequest): string | null {
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return req.cookies.get(COOKIE_NAME)?.value || null;
}

export async function getTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value || null;
}

export function authCookieOptions(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  };
}

export function clearAuthCookieOptions() {
  return {
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  };
}

export function canEditDatasheet(user: AuthUser, ds: DatasheetRecord): boolean {
  return canEditDatasheetPerm(user, ds);
}

export { canViewDatasheet, type DatasheetRecord } from '@/lib/permissions';

export function requireRole(user: AuthUser, roles: UserRole[]): boolean {
  return roles.includes(user.role);
}

export function applySeenBy(
  formData: Record<string, unknown>,
  userName: string,
  role?: UserRole,
): Record<string, unknown> {
  // Seen By is the Assessor who attended — only stamp when the actor is an Assessor.
  if (role !== 'Assessor') return formData;
  const signOff = { ...((formData.signOff as Record<string, unknown>) || {}) };
  signOff.seenBy = userName;
  return { ...formData, signOff };
}
