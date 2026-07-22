import { NextRequest, NextResponse } from 'next/server';
import { badRequest, forbidden, getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { canManageProductionAdmin } from '@/lib/productionPermissions';
import { listTargets, upsertTarget } from '@/lib/productionDb';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (!canManageProductionAdmin(user)) return forbidden();
    const targets = await listTargets();
    return NextResponse.json({ targets });
  } catch (err) {
    return handleRouteError(err, 'GET /api/production/targets');
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (!canManageProductionAdmin(user)) return forbidden();
    const body = await req.json();
    const period_type = String(body.period_type || '');
    const period_key = String(body.period_key || '').trim();
    if (!['daily', 'weekly', 'monthly'].includes(period_type)) {
      return badRequest('period_type must be daily, weekly, or monthly');
    }
    if (!period_key) return badRequest('period_key is required');
    const target = await upsertTarget({
      period_type: period_type as 'daily' | 'weekly' | 'monthly',
      period_key,
      target_jobs: Number(body.target_jobs) || 0,
      target_amount: Number(body.target_amount) || 0,
    });
    return NextResponse.json({ target }, { status: 201 });
  } catch (err) {
    return handleRouteError(err, 'POST /api/production/targets');
  }
}
