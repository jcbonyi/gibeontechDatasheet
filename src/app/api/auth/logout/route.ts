import { NextResponse } from 'next/server';
import { clearAuthCookieOptions } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(clearAuthCookieOptions());
  return response;
}
