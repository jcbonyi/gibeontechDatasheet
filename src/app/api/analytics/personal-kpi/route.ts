import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { listProductionEntries } from '@/lib/productionDb';
import { listDatasheets } from '@/lib/db';
import {
  computeAllIndividualMonthlyKpis,
  computeIndividualMonthlyKpi,
  computeTeamOverallKpi,
  findKpiTargetByKey,
  findKpiTargetForName,
  listKpiPeriodOptions,
  resolveKpiMonthRange,
} from '@/lib/individualMonthlyKpis';
import { canViewAllDatasheets } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const month = resolveKpiMonthRange(searchParams.get('month'));
    const personKey = (searchParams.get('person') || '').trim().toLowerCase();
    const canManage = canViewAllDatasheets(user.role);

    const [entries, datasheets] = await Promise.all([
      listProductionEntries({ fromDate: month.fromDate, toDate: month.toDate }),
      listDatasheets({ viewAll: true }),
    ]);

    const pendingRows = datasheets.map((d) => ({
      status: d.status,
      assigned_to: d.assigned_to,
      assigned_to_name: d.assigned_to_name,
    }));

    const myTarget = findKpiTargetForName(user.name);
    const me = myTarget
      ? computeIndividualMonthlyKpi(myTarget, entries, {
          userId: user.id,
          pendingRows,
        })
      : null;

    const team = canManage
      ? computeAllIndividualMonthlyKpis(entries, pendingRows)
      : undefined;

    const overall = team ? computeTeamOverallKpi(team) : undefined;

    let selectedPerson = null;
    if (canManage && personKey) {
      const target = findKpiTargetByKey(personKey);
      selectedPerson = target
        ? computeIndividualMonthlyKpi(target, entries, { pendingRows })
        : null;
    }

    return NextResponse.json({
      periodKey: month.periodKey,
      monthLabel: month.label,
      fromDate: month.fromDate,
      toDate: month.toDate,
      isCurrent: month.isCurrent,
      periods: listKpiPeriodOptions(12),
      me,
      team,
      overall,
      person: personKey ? selectedPerson : undefined,
      canManageReports: canManage,
    });
  } catch (err) {
    return handleRouteError(err, 'GET /api/analytics/personal-kpi');
  }
}
