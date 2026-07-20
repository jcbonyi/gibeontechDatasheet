import { NextRequest, NextResponse } from 'next/server';
import { listDatasheets } from '@/lib/db';
import { getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { canViewAllDatasheets } from '@/lib/permissions';
import { buildAnalyticsSummary, toListItem } from '@/lib/tracking';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const fromDate = searchParams.get('fromDate') || undefined;
    const toDate = searchParams.get('toDate') || undefined;
    const assessorId = searchParams.get('assessorId')
      ? Number(searchParams.get('assessorId'))
      : undefined;
    const status = searchParams.get('status') || undefined;

    const rows = await listDatasheets({
      status,
      assessorId,
      fromDate,
      toDate,
      viewAll: canViewAllDatasheets(user.role),
      scopeUserId: canViewAllDatasheets(user.role) ? undefined : user.id,
    });

    const items = rows.map(toListItem);
    const summary = buildAnalyticsSummary(items);

    return NextResponse.json({ summary, filters: { fromDate, toDate, assessorId, status } });
  } catch (err) {
    return handleRouteError(err, 'GET /api/analytics');
  }
}
