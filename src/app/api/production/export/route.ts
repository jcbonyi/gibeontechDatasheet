import { NextRequest, NextResponse } from 'next/server';
import { forbidden, getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { canAccessProduction } from '@/lib/productionPermissions';
import { listProductionEntries } from '@/lib/productionDb';
import { buildProductionSummary } from '@/lib/productionAnalytics';
import {
  buildProductionExcel,
  buildProductionPdf,
} from '@/lib/productionExport';
import { formatDisplayDate } from '@/lib/productionConfig';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (!canAccessProduction(user)) return forbidden();

    const { searchParams } = new URL(req.url);
    const format = (searchParams.get('format') || 'xlsx').toLowerCase();
    const fromDate = searchParams.get('fromDate') || undefined;
    const toDate = searchParams.get('toDate') || undefined;
    const pack = searchParams.get('pack') || 'register';
    const isStatement = pack === 'statement';

    const entries = await listProductionEntries({
      fromDate,
      toDate,
      insurerId: searchParams.get('insurerId')
        ? Number(searchParams.get('insurerId'))
        : undefined,
      doneByUserId: searchParams.get('doneBy')
        ? Number(searchParams.get('doneBy'))
        : undefined,
      status: searchParams.get('status') || undefined,
      paidStatus: searchParams.get('paid') || undefined,
      q: searchParams.get('q') || undefined,
      registrationNumber: searchParams.get('regNo') || undefined,
      instructedBy: searchParams.get('instructedBy') || undefined,
      seenByUserId: searchParams.get('seenBy')
        ? Number(searchParams.get('seenBy'))
        : undefined,
    });
    const summary = buildProductionSummary(entries);
    const stamp = formatDisplayDate(new Date().toISOString()).replace(/-/g, '');

    const opts = { pack, fromDate, toDate, statement: isStatement };

    if (format === 'csv') {
      return NextResponse.json(
        { message: 'CSV export has been removed. Use Excel or PDF instead.' },
        { status: 410 },
      );
    }

    if (format === 'pdf') {
      if (isStatement) {
        return NextResponse.json(
          { message: 'Statement is Excel only. Use the Statement button for Excel export.' },
          { status: 400 },
        );
      }
      const buf = buildProductionPdf(entries, summary, opts);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="GibeonTech-Production-${stamp}.pdf"`,
        },
      });
    }

    const buffer = await buildProductionExcel(entries, summary, opts);
    const filename = isStatement
      ? `GibeonTech-Production-Statement-${stamp}.xlsx`
      : `GibeonTech-Production-${pack}-${stamp}.xlsx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return handleRouteError(err, 'GET /api/production/export');
  }
}
