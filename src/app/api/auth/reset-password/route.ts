import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { badRequest } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { hashPassword } from '@/lib/auth';
import { updateUserRecord } from '@/lib/db';
import { consumePasswordResetToken } from '@/lib/productionDb';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = String(body.token || '').trim();
    const password = String(body.password || '');
    if (!token) return badRequest('Reset token is required');
    if (password.length < 8) return badRequest('Password must be at least 8 characters');

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const consumed = await consumePasswordResetToken(tokenHash);
    if (!consumed) return badRequest('Invalid or expired reset token');

    const password_hash = await hashPassword(password);
    await updateUserRecord(consumed.userId, { password_hash });
    return NextResponse.json({ message: 'Password updated. You can sign in now.' });
  } catch (err) {
    return handleRouteError(err, 'POST /api/auth/reset-password');
  }
}
