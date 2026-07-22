import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { forbidden, getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { canAccessProduction } from '@/lib/productionPermissions';
import { listProductionEntries } from '@/lib/productionDb';
import { buildProductionSummary, formatMoney } from '@/lib/productionAnalytics';
import { COMPANY } from '@/constants/brand';

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
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === 'csv') {
      const header =
        'Date,Reg No,Assignment,Insurer,Amount,Without VAT,Done By,Seen By,Instructed By,Status,Remarks\n';
      const lines = entries.map((e) =>
        [
          e.production_date,
          e.registration_number,
          e.assignment || '',
          e.insurer_name || '',
          e.amount,
          e.amount_without_vat,
          e.done_by_name || '',
          e.seen_by_name || '',
          e.instructed_by_name || '',
          e.status,
          (e.remarks || '').replace(/,/g, ';'),
        ].join(','),
      );
      const csv = header + lines.join('\n');
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="production-${stamp}.csv"`,
        },
      });
    }

    if (format === 'pdf') {
      const pdf = new jsPDF();
      pdf.setFontSize(14);
      pdf.text(`${COMPANY.name} — Production Report`, 14, 16);
      pdf.setFontSize(10);
      pdf.text(`Pack: ${pack} · ${fromDate || '…'} to ${toDate || '…'}`, 14, 22);
      pdf.text(
        `Jobs: ${summary.kpis.totalJobs} · Amount: ${formatMoney(summary.kpis.totalAmount)} · Without VAT: ${formatMoney(summary.kpis.totalWithoutVat)}`,
        14,
        28,
      );
      autoTable(pdf, {
        startY: 34,
        head: [['Date', 'Reg', 'Assignment', 'Insurer', 'Amount', 'Done By', 'Status']],
        body: entries.slice(0, 200).map((e) => [
          e.production_date,
          e.registration_number,
          e.assignment || '—',
          e.insurer_name || '—',
          formatMoney(e.amount),
          e.done_by_name || '—',
          e.status,
        ]),
        styles: { fontSize: 8 },
      });
      const buf = Buffer.from(pdf.output('arraybuffer'));
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="production-${stamp}.pdf"`,
        },
      });
    }

    const wb = new ExcelJS.Workbook();
    const reg = wb.addWorksheet('Register');
    reg.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Reg No', key: 'reg', width: 14 },
      { header: 'Assignment', key: 'assignment', width: 20 },
      { header: 'Insurer', key: 'insurer', width: 22 },
      { header: 'Amount', key: 'amount', width: 12 },
      { header: 'Without VAT', key: 'net', width: 12 },
      { header: 'Done By', key: 'done', width: 16 },
      { header: 'Seen By', key: 'seen', width: 16 },
      { header: 'Instructed By', key: 'inst', width: 16 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Remarks', key: 'remarks', width: 28 },
    ];
    entries.forEach((e) =>
      reg.addRow({
        date: e.production_date,
        reg: e.registration_number,
        assignment: e.assignment,
        insurer: e.insurer_name,
        amount: e.amount,
        net: e.amount_without_vat,
        done: e.done_by_name,
        seen: e.seen_by_name,
        inst: e.instructed_by_name,
        status: e.status,
        remarks: e.remarks,
      }),
    );

    const kpi = wb.addWorksheet('KPIs');
    kpi.addRow(['Metric', 'Value']);
    Object.entries(summary.kpis).forEach(([k, v]) => kpi.addRow([k, v ?? '—']));

    const byStaff = wb.addWorksheet('By Done By');
    byStaff.addRow(['Name', 'Jobs', 'Amount', 'Without VAT']);
    summary.byDoneBy.forEach((r) => byStaff.addRow([r.name, r.jobs, r.amount, r.withoutVat]));

    const byIns = wb.addWorksheet('By Insurer');
    byIns.addRow(['Name', 'Jobs', 'Amount', 'Without VAT']);
    summary.byInsurer.forEach((r) => byIns.addRow([r.name, r.jobs, r.amount, r.withoutVat]));

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return new NextResponse(buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="production-${pack}-${stamp}.xlsx"`,
      },
    });
  } catch (err) {
    return handleRouteError(err, 'GET /api/production/export');
  }
}
