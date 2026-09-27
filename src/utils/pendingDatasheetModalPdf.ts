import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { COMPANY } from '@/constants/brand';
import { formatMoney, formatDisplayDate } from '@/lib/productionConfig';
import { formatDelayNotesForPdf } from '@/lib/opsConfig';
import { STATUS_LABELS, normalizeStatus } from '@/lib/status';
import {
  formatDatasheetAssignment,
  sumProductionByAssignment,
  type DatasheetDrillEntry,
  type ProductionDrillEntry,
} from '@/lib/productionDashboardDrillDown';
import type { DatasheetStatus } from '@/types/datasheet';

const BRAND = { r: 63, g: 61, b: 153 };
const TEAL = { r: 38, g: 166, b: 154 };
const INK = { r: 30, g: 41, b: 59 };
const MUTED = { r: 100, g: 116, b: 139 };

function finalY(pdf: jsPDF, fallback: number): number {
  return (
    ((pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || fallback) +
    6
  );
}

export type DashboardDetailPdfInput =
  | {
      kind: 'production';
      title: string;
      subtitle?: string;
      rows: ProductionDrillEntry[];
      totalsContext?: {
        queryLabel: string;
        queryJobs: number;
        queryAmount: number;
        monthLabel: string;
        monthJobs: number;
        monthAmount: number;
        asOfDate: string;
      };
    }
  | {
      kind: 'datasheet';
      title: string;
      subtitle?: string;
      rows: DatasheetDrillEntry[];
    };

function safeFilename(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'dashboard-detail'
  );
}

function drawPdfHeader(pdf: jsPDF, reportLabel: string): number {
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 12;

  pdf.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  pdf.rect(0, 0, pageW, 20, 'F');
  pdf.setFillColor(TEAL.r, TEAL.g, TEAL.b);
  pdf.rect(0, 20, pageW, 1.2, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text(COMPANY.shortName, margin, 11);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text(COMPANY.name, margin, 16);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text(reportLabel, pageW - margin, 11, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text(`Generated ${new Date().toLocaleString()}`, pageW - margin, 16, { align: 'right' });

  return 28;
}

function drawPdfTitleBlock(
  pdf: jsPDF,
  y: number,
  title: string,
  subtitle: string | undefined,
  countLabel: string,
): number {
  const margin = 12;
  pdf.setTextColor(INK.r, INK.g, INK.b);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text(title, margin, y);
  y += 5;

  if (subtitle) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    pdf.text(subtitle, margin, y);
    y += 5;
  }

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  pdf.text(countLabel, margin, y);
  return y + 6;
}

function drawPdfFooter(pdf: jsPDF): void {
  const margin = 12;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  pdf.text(COMPANY.contactDetailsLine, margin, pdf.internal.pageSize.getHeight() - 8);
}

export function downloadDashboardDetailModalPdf(input: DashboardDetailPdfInput): void {
  const pdf =
    input.kind === 'production'
      ? buildProductionModalPdf(input.title, input.subtitle, input.rows, input.totalsContext)
      : buildDatasheetModalPdf(input.title, input.subtitle, input.rows);
  pdf.save(`${safeFilename(input.title)}.pdf`);
}

/** @deprecated Use downloadDashboardDetailModalPdf */
export function downloadPendingDatasheetModalPdf(
  title: string,
  subtitle: string | undefined,
  rows: DatasheetDrillEntry[],
): void {
  downloadDashboardDetailModalPdf({ kind: 'datasheet', title, subtitle, rows });
}

export function buildProductionModalPdf(
  title: string,
  subtitle: string | undefined,
  rows: ProductionDrillEntry[],
  totalsContext?: {
    queryLabel: string;
    queryJobs: number;
    queryAmount: number;
    monthLabel: string;
    monthJobs: number;
    monthAmount: number;
    asOfDate: string;
  },
): jsPDF {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 12;
  let y = drawPdfHeader(pdf, 'Production — Detail List');
  y = drawPdfTitleBlock(
    pdf,
    y,
    title,
    subtitle,
    `${rows.length} matching record${rows.length === 1 ? '' : 's'}`,
  );

  if (totalsContext) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(INK.r, INK.g, INK.b);
    pdf.text(
      `Query total: ${totalsContext.queryJobs} jobs · ${formatMoney(totalsContext.queryAmount)}  (${totalsContext.queryLabel})`,
      margin,
      y,
    );
    y += 4;
    pdf.text(
      `Month production as at ${formatDisplayDate(totalsContext.asOfDate)}: ${totalsContext.monthJobs} jobs · ${formatMoney(totalsContext.monthAmount)}`,
      margin,
      y,
    );
    y += 6;
  }

  const body = rows.map((r) => [
    formatDisplayDate(r.production_date.slice(0, 10)),
    r.registration_number,
    r.insurer_name || '—',
    r.assignment || '—',
    r.done_by_name || '—',
    formatMoney(r.amount),
  ]);

  autoTable(pdf, {
    startY: y,
    margin: { left: margin, right: margin, top: margin, bottom: 14 },
    head: [['Date', 'Reg.', 'Insurer', 'Assignment', 'Done by', 'Amount']],
    body: body.length ? body : [['—', '—', '—', '—', '—', 'No matching records']],
    styles: { fontSize: 8, cellPadding: 2.5, valign: 'middle' },
    headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 28, fontStyle: 'bold' },
      2: { cellWidth: 40 },
      3: { cellWidth: 32 },
      4: { cellWidth: 36 },
      5: { cellWidth: 28, halign: 'right' },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  y = finalY(pdf, y);

  const { totals, grandTotal } = sumProductionByAssignment(rows);
  const pageH = pdf.internal.pageSize.getHeight();
  if (y > pageH - 40) {
    pdf.addPage();
    y = 16;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  pdf.text('Totals by assignment', margin, y);
  y += 3;

  const summaryBody = [
    ...totals.map((t) => [
      `Total ${t.name}`,
      String(t.jobs),
      formatMoney(t.amount),
    ]),
    ['Modal total', String(rows.length), formatMoney(grandTotal)],
  ];

  autoTable(pdf, {
    startY: y,
    margin: { left: margin, right: margin, top: margin, bottom: 14 },
    head: [['Assignment total', 'Jobs', 'Amount']],
    body: summaryBody.length
      ? summaryBody
      : [['—', '0', formatMoney(0)]],
    styles: { fontSize: 8, cellPadding: 2.5, valign: 'middle' },
    headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: 'bold' },
      1: { cellWidth: 24, halign: 'right' },
      2: { cellWidth: 36, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.row.index === summaryBody.length - 1) {
        data.cell.styles.fillColor = [238, 242, 255];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = [BRAND.r, BRAND.g, BRAND.b];
      }
    },
  });

  drawPdfFooter(pdf);
  return pdf;
}

export function buildDatasheetModalPdf(
  title: string,
  subtitle: string | undefined,
  rows: DatasheetDrillEntry[],
): jsPDF {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 12;
  let y = drawPdfHeader(pdf, 'Datasheet Pending — Detail List');
  y = drawPdfTitleBlock(
    pdf,
    y,
    title,
    subtitle,
    `${rows.length} matching open task${rows.length === 1 ? '' : 's'}`,
  );

  const body = rows.map((r) => {
    const status = normalizeStatus(r.status) as DatasheetStatus;
    const age = r.age_days != null ? `${r.age_days}d${r.is_overdue ? ' (overdue)' : ''}` : '—';
    return [
      r.serial_no,
      r.claim_no || '—',
      r.reg_no || '—',
      formatDatasheetAssignment(r.form_types),
      STATUS_LABELS[status],
      r.client_insurer || '—',
      r.assigned_to_name || r.created_by_name || '—',
      r.repairer || '—',
      age,
      formatDelayNotesForPdf(r.delay_notes),
    ];
  });

  autoTable(pdf, {
    startY: y,
    margin: { left: margin, right: margin, top: margin, bottom: 14 },
    head: [
      [
        'Serial',
        'Claim',
        'Reg.',
        'Assignment',
        'Status',
        'Insurer',
        'Assessor',
        'Repairer',
        'Age',
        'Delay note(s)',
      ],
    ],
    body: body.length
      ? body
      : [['—', '—', '—', '—', '—', '—', '—', '—', '—', 'No matching records']],
    styles: { fontSize: 6.5, cellPadding: 1.8, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 18, fontStyle: 'bold' },
      1: { cellWidth: 20 },
      2: { cellWidth: 18 },
      3: { cellWidth: 24 },
      4: { cellWidth: 22 },
      5: { cellWidth: 24 },
      6: { cellWidth: 22 },
      7: { cellWidth: 28 },
      8: { cellWidth: 12 },
      9: { cellWidth: 'auto' },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 8 && rows[data.row.index]?.is_overdue) {
        data.cell.styles.textColor = [185, 28, 28];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  drawPdfFooter(pdf);
  return pdf;
}

/** @deprecated Use buildDatasheetModalPdf */
export const buildPendingDatasheetModalPdf = buildDatasheetModalPdf;

type ComparisonPdfInput = {
  title: string;
  subtitle?: string;
  person?: string;
  primaryLabel: string;
  compareLabel: string;
  primaryJobs: number;
  primaryAmount: number;
  compareJobs: number;
  compareAmount: number;
  jobsDelta: number | null;
  amountDelta: number | null;
  primaryTotalsContext: {
    queryLabel: string;
    queryJobs: number;
    queryAmount: number;
    monthLabel: string;
    monthJobs: number;
    monthAmount: number;
    asOfDate: string;
  };
  compareTotalsContext: {
    queryLabel: string;
    queryJobs: number;
    queryAmount: number;
    monthLabel: string;
    monthJobs: number;
    monthAmount: number;
    asOfDate: string;
  };
  jobsTrend: { label: string; a: number; b: number }[];
  amountTrend: { label: string; a: number; b: number }[];
  primaryRows: ProductionDrillEntry[];
  compareRows: ProductionDrillEntry[];
};

function drawDualSeriesTrend(
  pdf: jsPDF,
  y: number,
  title: string,
  points: { label: string; a: number; b: number }[],
  legendA: string,
  legendB: string,
  formatValue?: (n: number) => string,
): number {
  const margin = 12;
  const pageW = pdf.internal.pageSize.getWidth();
  const chartW = pageW - margin * 2;
  const chartH = 48;
  const padL = 10;
  const padR = 4;
  const padT = 6;
  const padB = 10;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  pdf.text(title, margin, y);
  y += 3;

  if (!points.length) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    pdf.text('No trend points for this comparison.', margin, y + 6);
    return y + 14;
  }

  const max = Math.max(...points.flatMap((p) => [p.a, p.b]), 1);
  const originX = margin + padL;
  const originY = y + padT + innerH;

  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.2);
  pdf.rect(margin, y, chartW, chartH);

  // grid
  for (let g = 0; g <= 4; g++) {
    const gy = originY - (innerH * g) / 4;
    pdf.line(originX, gy, originX + innerW, gy);
  }

  const toX = (i: number) =>
    originX + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const toY = (v: number) => originY - (v / max) * innerH;

  const drawSeries = (key: 'a' | 'b', color: { r: number; g: number; b: number }) => {
    pdf.setDrawColor(color.r, color.g, color.b);
    pdf.setFillColor(color.r, color.g, color.b);
    pdf.setLineWidth(0.7);
    for (let i = 0; i < points.length; i++) {
      const x = toX(i);
      const yy = toY(points[i][key]);
      if (i === 0) {
        // start path via line segments
      } else {
        pdf.line(toX(i - 1), toY(points[i - 1][key]), x, yy);
      }
      pdf.circle(x, yy, 0.8, 'F');
    }
  };

  drawSeries('a', BRAND);
  drawSeries('b', TEAL);

  // x labels (sparse)
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6);
  pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  const step = Math.max(1, Math.ceil(points.length / 8));
  for (let i = 0; i < points.length; i += step) {
    pdf.text(points[i].label.slice(0, 10), toX(i), originY + 4, { align: 'center' });
  }

  // max label
  const fmt = formatValue || ((n: number) => String(Math.round(n)));
  pdf.text(fmt(max), margin + 1, y + padT + 2);

  y += chartH + 4;
  pdf.setFontSize(7);
  pdf.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  pdf.text(`● ${legendA}`, margin, y);
  pdf.setTextColor(TEAL.r, TEAL.g, TEAL.b);
  pdf.text(`● ${legendB}`, margin + 55, y);
  return y + 6;
}

export function downloadComparisonModalPdf(input: ComparisonPdfInput): void {
  const pdf = buildComparisonModalPdf(input);
  pdf.save(`${safeFilename(input.title)}.pdf`);
}

export function buildComparisonModalPdf(input: ComparisonPdfInput): jsPDF {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 12;
  const pageH = pdf.internal.pageSize.getHeight();
  let y = drawPdfHeader(pdf, 'Production — Period Comparison');
  const personBit = input.person ? ` · ${input.person}` : ' · overall';
  y = drawPdfTitleBlock(
    pdf,
    y,
    input.title,
    input.subtitle,
    `A ${input.primaryJobs} jobs / ${formatMoney(input.primaryAmount)}  vs  B ${input.compareJobs} jobs / ${formatMoney(input.compareAmount)}${personBit}`,
  );

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(INK.r, INK.g, INK.b);
  pdf.text(`Period A: ${input.primaryLabel}`, margin, y);
  y += 4;
  pdf.text(
    `  Query ${input.primaryTotalsContext.queryJobs} · ${formatMoney(input.primaryTotalsContext.queryAmount)}  |  MTD as at ${formatDisplayDate(input.primaryTotalsContext.asOfDate)}: ${input.primaryTotalsContext.monthJobs} · ${formatMoney(input.primaryTotalsContext.monthAmount)}`,
    margin,
    y,
  );
  y += 5;
  pdf.text(`Period B: ${input.compareLabel}`, margin, y);
  y += 4;
  pdf.text(
    `  Query ${input.compareTotalsContext.queryJobs} · ${formatMoney(input.compareTotalsContext.queryAmount)}  |  MTD as at ${formatDisplayDate(input.compareTotalsContext.asOfDate)}: ${input.compareTotalsContext.monthJobs} · ${formatMoney(input.compareTotalsContext.monthAmount)}`,
    margin,
    y,
  );
  y += 5;
  if (input.jobsDelta != null || input.amountDelta != null) {
    const parts: string[] = [];
    if (input.jobsDelta != null) {
      parts.push(`Jobs ${input.jobsDelta >= 0 ? '+' : ''}${input.jobsDelta}%`);
    }
    if (input.amountDelta != null) {
      parts.push(`Value ${input.amountDelta >= 0 ? '+' : ''}${input.amountDelta}%`);
    }
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Change (A vs B): ${parts.join(' · ')}`, margin, y);
    y += 6;
  } else {
    y += 2;
  }

  const legendA = input.person ? `${input.person} · A` : 'Period A';
  const legendB = input.person ? `${input.person} · B` : 'Period B';

  y = drawDualSeriesTrend(pdf, y, 'Jobs trend · A vs B', input.jobsTrend, legendA, legendB);
  if (y > pageH - 70) {
    pdf.addPage();
    y = 16;
  }
  y = drawDualSeriesTrend(
    pdf,
    y,
    'Value trend · A vs B',
    input.amountTrend,
    `${legendA} value`,
    `${legendB} value`,
    (n) => formatMoney(n),
  );

  // Daily points table
  if (y > pageH - 50) {
    pdf.addPage();
    y = 16;
  }
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  pdf.text('Aligned daily points', margin, y);
  y += 2;

  autoTable(pdf, {
    startY: y,
    margin: { left: margin, right: margin, top: margin, bottom: 14 },
    head: [['Point', 'A jobs', 'B jobs', 'A value', 'B value']],
    body: (input.jobsTrend.length ? input.jobsTrend : [{ label: '—', a: 0, b: 0 }]).map((p, i) => {
      const amt = input.amountTrend[i] || { a: 0, b: 0 };
      return [
        p.label,
        String(p.a),
        String(p.b),
        formatMoney(amt.a),
        formatMoney(amt.b),
      ];
    }),
    styles: { fontSize: 7.5, cellPadding: 2, valign: 'middle' },
    headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  y = finalY(pdf, y);
  if (y > pageH - 40) {
    pdf.addPage();
    y = 16;
  }

  // Compact period record summaries
  const writeSide = (label: string, rows: ProductionDrillEntry[], startY: number) => {
    let yy = startY;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    pdf.text(label, margin, yy);
    yy += 2;
    const { grandTotal } = sumProductionByAssignment(rows);
    autoTable(pdf, {
      startY: yy,
      margin: { left: margin, right: margin, top: margin, bottom: 14 },
      head: [['Date', 'Reg.', 'Assignment', 'Done by', 'Amount']],
      body: rows.length
        ? rows.slice(0, 40).map((r) => [
            formatDisplayDate(r.production_date.slice(0, 10)),
            r.registration_number,
            r.assignment || '—',
            r.done_by_name || '—',
            formatMoney(r.amount),
          ])
        : [['—', '—', '—', '—', 'No records']],
      styles: { fontSize: 7, cellPadding: 1.8, valign: 'middle' },
      headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    yy = finalY(pdf, yy);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text(
      `Total · ${rows.length} jobs · ${formatMoney(grandTotal)}${
        rows.length > 40 ? ' (first 40 rows shown)' : ''
      }`,
      margin,
      yy,
    );
    return yy + 8;
  };

  y = writeSide(`Period A records · ${input.primaryLabel}`, input.primaryRows, y);
  if (y > pageH - 40) {
    pdf.addPage();
    y = 16;
  }
  writeSide(`Period B records · ${input.compareLabel}`, input.compareRows, y);

  drawPdfFooter(pdf);
  return pdf;
}
