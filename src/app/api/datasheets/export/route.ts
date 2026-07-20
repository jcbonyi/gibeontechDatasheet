import { NextRequest, NextResponse } from 'next/server';

/** @deprecated Prefer /api/reports/export — kept for backward compatibility. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const target = new URL('/api/reports/export', url.origin);
  url.searchParams.forEach((value, key) => target.searchParams.set(key, value));
  if (!target.searchParams.has('format')) target.searchParams.set('format', 'csv');
  if (!target.searchParams.has('pack')) target.searchParams.set('pack', 'register');
  return NextResponse.redirect(target);
}
