import { NextRequest, NextResponse } from 'next/server';
import { listAllAuditsForDatasheets, listDatasheets } from '@/lib/db';
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
    const insurer = searchParams.get('insurer') || undefined;

    const rows = await listDatasheets({
      status,
      assessorId,
      fromDate,
      toDate,
      insurer,
      viewAll: canViewAllDatasheets(user.role),
      scopeUserId: canViewAllDatasheets(user.role) ? undefined : user.id,
    });

    const items = rows.map(toListItem);
    const audits = await listAllAuditsForDatasheets(items.map((r) => r.id));
    const summary = buildAnalyticsSummary(items, audits);

    return NextResponse.json({ summary, filters: { fromDate, toDate, assessorId, status, insurer } });
  } catch (err) {
    return handleRouteError(err, 'GET /api/analytics');
  }
}
