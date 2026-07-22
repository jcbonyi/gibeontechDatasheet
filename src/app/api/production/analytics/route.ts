import { NextRequest, NextResponse } from 'next/server';
import { forbidden, getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { canAccessProduction } from '@/lib/productionPermissions';
import { listProductionEntries, listTargets } from '@/lib/productionDb';
import { buildProductionSummary } from '@/lib/productionAnalytics';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (!canAccessProduction(user)) return forbidden();

    const { searchParams } = new URL(req.url);
    const fromDate = searchParams.get('fromDate') || undefined;
    const toDate = searchParams.get('toDate') || undefined;
    const entries = await listProductionEntries({ fromDate, toDate });
    const targets = await listTargets();
    const summary = buildProductionSummary(entries, targets);
    return NextResponse.json({ summary });
  } catch (err) {
    return handleRouteError(err, 'GET /api/production/analytics');
  }
}
