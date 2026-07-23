import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BRAND_COLORS, COMPANY } from '@/constants/brand';
import type { DbProductionEntry } from '@/lib/productionDb';
import type { ProductionSummary } from '@/lib/productionAnalytics';
import { formatMoney } from '@/lib/productionConfig';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Display dates as dd-mmm-yyyy (e.g. 23-Jul-2026). */
export function formatDisplayDate(value: string | null | undefined): string {
  const s = String(value || '').slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s || '—';
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return s;
  return `${m[3]}-${month}-${m[1]}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

const PURPLE = hexToRgb(BRAND_COLORS.purple);
const TEAL = hexToRgb(BRAND_COLORS.teal);
const PURPLE_ARGB = 'FF4B499E';
const TEAL_ARGB = 'FF26A69A';
const HEADER_TEXT = 'FFFFFFFF';
const ALT_ROW = 'FFF5F5FA';

function loadLogoBuffer(): Buffer | null {
  try {
    return fs.readFileSync(path.join(process.cwd(), 'public', 'gibeontech-logo.png'));
  } catch {
    return null;
  }
}

function loadLogoDataUrl(): string | null {
  const buf = loadLogoBuffer();
  if (!buf) return null;
  return `data:image/png;base64,${buf.toString('base64')}`;
}

function periodLabel(fromDate?: string, toDate?: string): string {
  if (fromDate && toDate) {
    return `${formatDisplayDate(fromDate)} to ${formatDisplayDate(toDate)}`;
  }
  if (fromDate) return `From ${formatDisplayDate(fromDate)}`;
  if (toDate) return `Until ${formatDisplayDate(toDate)}`;
  return 'All dates';
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.height = 22;
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: PURPLE_ARGB },
    };
    cell.font = { bold: true, color: { argb: HEADER_TEXT }, size: 10, name: 'Calibri' };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      bottom: { style: 'thin', color: { argb: TEAL_ARGB } },
    };
  });
}

function applyDataRowStyle(row: ExcelJS.Row, index: number) {
  row.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
    cell.alignment = { vertical: 'middle' };
    if (index % 2 === 1) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: ALT_ROW },
      };
    }
    cell.border = {
      bottom: { style: 'hair', color: { argb: 'FFDCE0EA' } },
    };
  });
}

function addBrandedTitleBlock(
  sheet: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  logoId: number | null,
) {
  sheet.mergeCells('A1:D1');
  sheet.getCell('A1').value = COMPANY.name;
  sheet.getCell('A1').font = {
    name: 'Calibri',
    bold: true,
    size: 14,
    color: { argb: PURPLE_ARGB },
  };
  sheet.getCell('A1').alignment = { vertical: 'middle' };

  sheet.mergeCells('A2:D2');
  sheet.getCell('A2').value = title;
  sheet.getCell('A2').font = {
    name: 'Calibri',
    bold: true,
    size: 12,
    color: { argb: TEAL_ARGB },
  };

  sheet.mergeCells('A3:D3');
  sheet.getCell('A3').value = subtitle;
  sheet.getCell('A3').font = {
    name: 'Calibri',
    size: 9,
    color: { argb: 'FF64748B' },
  };

  sheet.getRow(1).height = 22;
  sheet.getRow(2).height = 18;
  sheet.getRow(3).height = 16;
  sheet.getRow(4).height = 8;

  if (logoId != null) {
    sheet.addImage(logoId, {
      tl: { col: 4.2, row: 0.15 },
      ext: { width: 150, height: 34 },
    });
  }
}

export async function buildProductionExcel(
  entries: DbProductionEntry[],
  summary: ProductionSummary,
  opts: { pack: string; fromDate?: string; toDate?: string },
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = COMPANY.shortName;
  wb.company = COMPANY.name;
  wb.created = new Date();

  const logoBuf = loadLogoBuffer();
  const logoId =
    logoBuf != null
      ? wb.addImage({
          buffer: logoBuf as unknown as ExcelJS.Buffer,
          extension: 'png',
        })
      : null;

  const subtitle = `Period: ${periodLabel(opts.fromDate, opts.toDate)} · Generated ${formatDisplayDate(new Date().toISOString())} · ${entries.length} jobs`;

  // —— Register ——
  const reg = wb.addWorksheet('Register', {
    properties: { tabColor: { argb: PURPLE_ARGB } },
    views: [{ state: 'frozen', ySplit: 5 }],
  });
  addBrandedTitleBlock(reg, 'Production Register', subtitle, logoId);

  const headers = [
    'Date',
    'Reg No',
    'Assignment',
    'Insurer',
    'Amount',
    'Without VAT',
    'Done By',
    'Seen By',
    'Instructed By',
    'Status',
    'Remarks',
  ];
  const headerRow = reg.getRow(5);
  headers.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h;
  });
  styleHeaderRow(headerRow);

  entries.forEach((e, idx) => {
    const row = reg.addRow([
      formatDisplayDate(e.production_date),
      e.registration_number,
      e.assignment || '',
      e.insurer_name || '',
      Number(e.amount) || 0,
      Number(e.amount_without_vat) || 0,
      e.done_by_name || '',
      e.seen_by_name || '',
      e.instructed_by_name || '',
      e.status,
      e.remarks || '',
    ]);
    applyDataRowStyle(row, idx);
    row.getCell(5).numFmt = '#,##0.00';
    row.getCell(6).numFmt = '#,##0.00';
  });

  const widths = [14, 14, 18, 22, 12, 12, 16, 16, 18, 12, 28];
  widths.forEach((w, i) => {
    reg.getColumn(i + 1).width = w;
  });

  // Totals footer
  if (entries.length) {
    const totalRow = reg.addRow([
      '',
      '',
      '',
      'TOTAL',
      summary.kpis.totalAmount,
      summary.kpis.totalWithoutVat,
      '',
      '',
      '',
      `${summary.kpis.totalJobs} jobs`,
      '',
    ]);
    totalRow.eachCell((cell) => {
      cell.font = { bold: true, name: 'Calibri', size: 10, color: { argb: PURPLE_ARGB } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8E8F4' },
      };
    });
    totalRow.getCell(5).numFmt = '#,##0.00';
    totalRow.getCell(6).numFmt = '#,##0.00';
  }

  // —— KPIs ——
  const kpi = wb.addWorksheet('KPIs', {
    properties: { tabColor: { argb: TEAL_ARGB } },
  });
  addBrandedTitleBlock(kpi, 'Production KPIs', subtitle, logoId);
  const kpiHead = kpi.getRow(5);
  kpiHead.getCell(1).value = 'Metric';
  kpiHead.getCell(2).value = 'Value';
  styleHeaderRow(kpiHead);
  kpi.getColumn(1).width = 28;
  kpi.getColumn(2).width = 22;

  const kpiRows: [string, string | number][] = [
    ['Today jobs', summary.kpis.todayJobs],
    ["Today amount", summary.kpis.todayAmount],
    ['This week jobs', summary.kpis.weekJobs],
    ['This week amount', summary.kpis.weekAmount],
    ['This month jobs', summary.kpis.monthJobs],
    ['This month amount', summary.kpis.monthAmount],
    ['Total jobs', summary.kpis.totalJobs],
    ['Total amount', summary.kpis.totalAmount],
    ['Total without VAT', summary.kpis.totalWithoutVat],
    ['Avg per job', summary.kpis.avgPerJob ?? '—'],
    ['Avg per user', summary.kpis.avgPerUser ?? '—'],
    ['Top staff', summary.kpis.topStaff || '—'],
    ['Top insurer', summary.kpis.topInsurer || '—'],
  ];
  kpiRows.forEach(([label, value], idx) => {
    const row = kpi.addRow([label, value]);
    applyDataRowStyle(row, idx);
    if (typeof value === 'number' && label.toLowerCase().includes('amount')) {
      row.getCell(2).numFmt = '#,##0.00';
    }
  });

  // —— By Done By ——
  const byStaff = wb.addWorksheet('By Done By', {
    properties: { tabColor: { argb: PURPLE_ARGB } },
  });
  addBrandedTitleBlock(byStaff, 'Production by Done By', subtitle, logoId);
  const staffHead = byStaff.getRow(5);
  ['Name', 'Jobs', 'Amount', 'Without VAT'].forEach((h, i) => {
    staffHead.getCell(i + 1).value = h;
  });
  styleHeaderRow(staffHead);
  [28, 10, 14, 14].forEach((w, i) => {
    byStaff.getColumn(i + 1).width = w;
  });
  summary.byDoneBy.forEach((r, idx) => {
    const row = byStaff.addRow([r.name, r.jobs, r.amount, r.withoutVat]);
    applyDataRowStyle(row, idx);
    row.getCell(3).numFmt = '#,##0.00';
    row.getCell(4).numFmt = '#,##0.00';
  });

  // —— By Insurer ——
  const byIns = wb.addWorksheet('By Insurer', {
    properties: { tabColor: { argb: TEAL_ARGB } },
  });
  addBrandedTitleBlock(byIns, 'Production by Insurer', subtitle, logoId);
  const insHead = byIns.getRow(5);
  ['Name', 'Jobs', 'Amount', 'Without VAT'].forEach((h, i) => {
    insHead.getCell(i + 1).value = h;
  });
  styleHeaderRow(insHead);
  [28, 10, 14, 14].forEach((w, i) => {
    byIns.getColumn(i + 1).width = w;
  });
  summary.byInsurer.forEach((r, idx) => {
    const row = byIns.addRow([r.name, r.jobs, r.amount, r.withoutVat]);
    applyDataRowStyle(row, idx);
    row.getCell(3).numFmt = '#,##0.00';
    row.getCell(4).numFmt = '#,##0.00';
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function buildProductionPdf(
  entries: DbProductionEntry[],
  summary: ProductionSummary,
  opts: { pack: string; fromDate?: string; toDate?: string },
): Buffer {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 12;

  // Header band
  pdf.setFillColor(PURPLE.r, PURPLE.g, PURPLE.b);
  pdf.rect(0, 0, pageW, 22, 'F');
  pdf.setFillColor(TEAL.r, TEAL.g, TEAL.b);
  pdf.rect(0, 22, pageW, 1.6, 'F');

  const logo = loadLogoDataUrl();
  if (logo) {
    try {
      pdf.addImage(logo, 'PNG', margin, 4, 42, 10);
    } catch {
      /* ignore logo failure */
    }
  } else {
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text(COMPANY.shortName, margin, 12);
  }

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('Production Report', pageW - margin, 10, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text(COMPANY.name, pageW - margin, 16, { align: 'right' });

  // Meta strip
  let y = 28;
  pdf.setTextColor(30, 41, 59);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text(`Period: ${periodLabel(opts.fromDate, opts.toDate)}`, margin, y);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  pdf.text(
    `Generated ${formatDisplayDate(new Date().toISOString())} · Pack: ${opts.pack}`,
    pageW - margin,
    y,
    { align: 'right' },
  );

  // KPI chips
  y = 34;
  const chips = [
    { label: 'Jobs', value: String(summary.kpis.totalJobs) },
    { label: 'Amount', value: formatMoney(summary.kpis.totalAmount) },
    { label: 'Without VAT', value: formatMoney(summary.kpis.totalWithoutVat) },
    { label: 'Top staff', value: summary.kpis.topStaff || '—' },
  ];
  const chipW = (pageW - margin * 2 - 6) / chips.length;
  chips.forEach((chip, i) => {
    const x = margin + i * (chipW + 2);
    pdf.setFillColor(245, 245, 250);
    pdf.setDrawColor(BRAND_COLORS.purple);
    pdf.roundedRect(x, y, chipW, 12, 1.5, 1.5, 'FD');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.5);
    pdf.setTextColor(PURPLE.r, PURPLE.g, PURPLE.b);
    pdf.text(chip.label.toUpperCase(), x + 3, y + 4.2);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(30, 41, 59);
    pdf.text(chip.value, x + 3, y + 9.5);
  });

  autoTable(pdf, {
    startY: y + 16,
    head: [
      [
        'Date',
        'Reg No',
        'Assignment',
        'Insurer',
        'Amount',
        'Without VAT',
        'Done By',
        'Seen By',
        'Instructed By',
        'Status',
      ],
    ],
    body: entries.slice(0, 500).map((e) => [
      formatDisplayDate(e.production_date),
      e.registration_number,
      e.assignment || '—',
      e.insurer_name || '—',
      formatMoney(e.amount),
      formatMoney(e.amount_without_vat),
      e.done_by_name || '—',
      e.seen_by_name || '—',
      e.instructed_by_name || '—',
      e.status,
    ]),
    styles: {
      fontSize: 7.5,
      cellPadding: 1.6,
      textColor: [30, 41, 59],
      lineColor: [220, 224, 234],
      lineWidth: 0.1,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [PURPLE.r, PURPLE.g, PURPLE.b],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 250],
    },
    columnStyles: {
      0: { cellWidth: 22 },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
    margin: { left: margin, right: margin },
    didDrawPage: (data) => {
      // Footer
      pdf.setFillColor(TEAL.r, TEAL.g, TEAL.b);
      pdf.rect(0, pageH - 8, pageW, 8, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.text(
        `${COMPANY.website} · ${COMPANY.phones} · ${COMPANY.email}`,
        margin,
        pageH - 3,
      );
      pdf.text(
        `Page ${data.pageNumber}`,
        pageW - margin,
        pageH - 3,
        { align: 'right' },
      );
    },
  });

  if (entries.length > 500) {
    const finalY =
      (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ||
      pageH - 20;
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text(
      `Showing first 500 of ${entries.length} rows. Export Excel for the full register.`,
      margin,
      finalY + 8,
    );
  }

  return Buffer.from(pdf.output('arraybuffer'));
}

export function buildProductionCsv(entries: DbProductionEntry[]): string {
  const header =
    'Date,Reg No,Assignment,Insurer,Amount,Without VAT,Done By,Seen By,Instructed By,Status,Remarks\n';
  const lines = entries.map((e) =>
    [
      formatDisplayDate(e.production_date),
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
  return header + lines.join('\n');
}
