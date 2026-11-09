import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { listProductionEntries } from '@/lib/productionDb';
import {
  calendarMonthRange,
  computeAllIndividualMonthlyKpis,
  computeIndividualMonthlyKpi,
  findKpiTargetForName,
} from '@/lib/individualMonthlyKpis';
import { canViewAllDatasheets } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const month = calendarMonthRange();
    const entries = await listProductionEntries({
      fromDate: month.fromDate,
      toDate: month.toDate,
    });

    const myTarget = findKpiTargetForName(user.name);
    const me = myTarget
      ? computeIndividualMonthlyKpi(myTarget, entries, { userId: user.id })
      : null;

    const team = canViewAllDatasheets(user.role)
      ? computeAllIndividualMonthlyKpis(entries)
      : undefined;

    return NextResponse.json({
      monthLabel: month.label,
      fromDate: month.fromDate,
      toDate: month.toDate,
      me,
      team,
    });
  } catch (err) {
    return handleRouteError(err, 'GET /api/analytics/personal-kpi');
  }
}
