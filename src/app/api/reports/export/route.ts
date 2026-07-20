import { NextRequest, NextResponse } from 'next/server';
import { listAllAuditsForDatasheets, listDatasheets } from '@/lib/db';
import { getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { canViewAllDatasheets } from '@/lib/permissions';
import { buildAnalyticsSummary, toListItem } from '@/lib/tracking';
import { buildOpsWorkbook, buildRegisterWorkbook } from '@/utils/excelExport';
import { analyticsReportToBuffer } from '@/utils/analyticsPdfReport';

function parseFilters(req: NextRequest, userId: number, viewAll: boolean) {
  const { searchParams } = new URL(req.url);
  return {
    status: searchParams.get('status') || undefined,
    claimNo: searchParams.get('claimNo') || undefined,
    regNo: searchParams.get('regNo') || undefined,
    assessorId: searchParams.get('assessorId')
      ? Number(searchParams.get('assessorId'))
      : undefined,
    fromDate: searchParams.get('fromDate') || undefined,
    toDate: searchParams.get('toDate') || undefined,
    insurer: searchParams.get('insurer') || undefined,
    q: searchParams.get('q') || undefined,
    format: (searchParams.get('format') || 'xlsx').toLowerCase(),
    pack: (searchParams.get('pack') || 'register').toLowerCase(),
    viewAll,
    scopeUserId: viewAll ? undefined : userId,
  };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const filters = parseFilters(req, user.id, canViewAllDatasheets(user.role));
    const rows = (await listDatasheets(filters)).map(toListItem);
    const audits = await listAllAuditsForDatasheets(rows.map((r) => r.id));
    const dateStamp = new Date().toISOString().slice(0, 10);

    if (filters.format === 'pdf' || filters.pack === 'analytics-pdf') {
      const summary = buildAnalyticsSummary(rows, audits);
      const buffer = analyticsReportToBuffer(summary, {
        fromDate: filters.fromDate,
        toDate: filters.toDate,
      });
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="analytics-report-${dateStamp}.pdf"`,
        },
      });
    }

    if (filters.format === 'csv') {
      const header = [
        'Serial',
        'Claim No',
        'Reg No',
        'Status',
        'Client/Insurer',
        'Form Types',
        'Date of Instruction',
        'Age (days)',
        'Age Band',
        'Overdue',
        'Created By',
        'Assigned To',
        'Updated',
      ];
      const lines = rows.map((d) =>
        [
          d.serial_no,
          d.claim_no || '',
          d.reg_no || '',
          d.status,
          d.client_insurer || '',
          d.form_types.join('; '),
          d.date_of_instruction || '',
          d.age_days ?? '',
          d.age_band,
          d.is_overdue ? 'Yes' : 'No',
          d.created_by_name || '',
          d.assigned_to_name || '',
          d.updated_at,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      );
      const csv = [header.join(','), ...lines].join('\n');
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="datasheets-${dateStamp}.csv"`,
        },
      });
    }

    const summary = buildAnalyticsSummary(rows, audits);
    const buffer =
      filters.pack === 'ops'
        ? await buildOpsWorkbook(rows, summary)
        : await buildRegisterWorkbook(rows);

    const filename =
      filters.pack === 'ops'
        ? `ops-report-${dateStamp}.xlsx`
        : `datasheets-${dateStamp}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return handleRouteError(err, 'GET /api/reports/export');
  }
}
