import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { COMPANY } from '@/constants/brand';
import { formatMoney, formatDisplayDate } from '@/lib/productionConfig';
import { formatDelayNotesForPdf } from '@/lib/opsConfig';
import { STATUS_LABELS, normalizeStatus } from '@/lib/status';
import {
  formatDatasheetAssignment,
  type DatasheetDrillEntry,
  type ProductionDrillEntry,
} from '@/lib/productionDashboardDrillDown';
import type { DatasheetStatus } from '@/types/datasheet';

const BRAND = { r: 63, g: 61, b: 153 };
const TEAL = { r: 38, g: 166, b: 154 };
const INK = { r: 30, g: 41, b: 59 };
const MUTED = { r: 100, g: 116, b: 139 };

export type DashboardDetailPdfInput =
  | {
      kind: 'production';
      title: string;
      subtitle?: string;
      rows: ProductionDrillEntry[];
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
      ? buildProductionModalPdf(input.title, input.subtitle, input.rows)
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
        'Age',
        'Delay note(s)',
      ],
    ],
    body: body.length
      ? body
      : [['—', '—', '—', '—', '—', '—', '—', '—', 'No matching records']],
    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 20, fontStyle: 'bold' },
      1: { cellWidth: 22 },
      2: { cellWidth: 20 },
      3: { cellWidth: 28 },
      4: { cellWidth: 24 },
      5: { cellWidth: 28 },
      6: { cellWidth: 24 },
      7: { cellWidth: 14 },
      8: { cellWidth: 'auto' },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 7 && rows[data.row.index]?.is_overdue) {
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
