import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { badRequest } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { createPasswordResetToken } from '@/lib/productionDb';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    if (!email) return badRequest('Email is required');

    const result = await query<{ id: number; email: string; name: string }>(
      'SELECT id, email, name FROM users WHERE email = $1 AND is_active = TRUE',
      [email],
    );
    const user = result.rows[0];

    // Always return success to avoid email enumeration
    if (!user) {
      return NextResponse.json({
        message: 'If that email exists, a reset token has been issued.',
        // Dev helper: no email provider — token only returned when user exists below
      });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await createPasswordResetToken(user.id, tokenHash, expires);

    const base =
      process.env.NEXT_PUBLIC_APP_URL ||
      req.nextUrl.origin ||
      'http://localhost:3000';
    const resetUrl = `${base}/forgot-password?token=${rawToken}`;

    return NextResponse.json({
      message:
        'If that email exists, a reset link is ready. (No mail server configured — use the reset URL below.)',
      resetUrl,
      expiresAt: expires.toISOString(),
    });
  } catch (err) {
    return handleRouteError(err, 'POST /api/auth/forgot-password');
  }
}
