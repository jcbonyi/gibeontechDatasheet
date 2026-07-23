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
      q: searchParams.get('q') || undefined,
    });
    const summary = buildProductionSummary(entries);
    const stamp = formatDisplayDate(new Date().toISOString()).replace(/-/g, '');

    const opts = { pack, fromDate, toDate };

    if (format === 'csv') {
      return NextResponse.json(
        { message: 'CSV export has been removed. Use Excel or PDF instead.' },
        { status: 410 },
      );
    }

    if (format === 'pdf') {
      const buf = buildProductionPdf(entries, summary, opts);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="GibeonTech-Production-${stamp}.pdf"`,
        },
      });
    }

    const buffer = await buildProductionExcel(entries, summary, opts);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="GibeonTech-Production-${pack}-${stamp}.xlsx"`,
      },
    });
  } catch (err) {
    return handleRouteError(err, 'GET /api/production/export');
  }
}
