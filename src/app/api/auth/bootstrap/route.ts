import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  authCookieOptions,
  createToken,
  hashPassword,
} from '@/lib/auth';
import { badRequest } from '@/lib/api';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!name || !email || !password || password.length < 8) {
    return badRequest('Name, email, and password (min 8 chars) are required');
  }

  const countResult = await query<{ count: string }>('SELECT COUNT(*) FROM users');
  const count = Number(countResult.rows[0]?.count || 0);
  if (count > 0) {
    return NextResponse.json({ message: 'Admin already exists. Use login.' }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const result = await query<{
    id: number;
    name: string;
    email: string;
    role: 'Admin';
    is_active: boolean;
  }>(
    'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, is_active',
    [name, email, passwordHash, 'Admin'],
  );

  const user = result.rows[0];
  const authUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.is_active,
  };

  const token = createToken(authUser);
  const response = NextResponse.json({ user: authUser, token });
  response.cookies.set(authCookieOptions(token));
  return response;
}

export async function GET() {
  const countResult = await query<{ count: string }>('SELECT COUNT(*) FROM users');
  const count = Number(countResult.rows[0]?.count || 0);
  return NextResponse.json({ needsBootstrap: count === 0 });
}
