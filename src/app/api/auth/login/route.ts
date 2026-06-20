import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authCookieOptions, createToken, verifyPassword } from '@/lib/auth';
import { badRequest } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';

import type { UserRole } from '@/types/datasheet';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) {
      return badRequest('Email and password are required');
    }

    const result = await query<{
      id: number;
      name: string;
      email: string;
      role: UserRole;
      is_active: boolean;
      password_hash: string;
    }>('SELECT id, name, email, role, is_active, password_hash FROM users WHERE email = $1', [
      email,
    ]);

    const user = result.rows[0];
    if (!user) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }
    if (!user.is_active) {
      return NextResponse.json({ message: 'Account is deactivated' }, { status: 403 });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

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
  } catch (err) {
    return handleRouteError(err, 'POST /api/auth/login');
  }
}
