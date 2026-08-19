import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { COMPANY } from '@/constants/brand';
import { formatDelayNotesForPdf } from '@/lib/opsConfig';
import { STATUS_LABELS, normalizeStatus } from '@/lib/status';
import type { DatasheetDrillEntry } from '@/lib/productionDashboardDrillDown';
import type { DatasheetStatus } from '@/types/datasheet';

const BRAND = { r: 63, g: 61, b: 153 };
const TEAL = { r: 38, g: 166, b: 154 };
const INK = { r: 30, g: 41, b: 59 };
const MUTED = { r: 100, g: 116, b: 139 };

function finalY(pdf: jsPDF, fallback: number): number {
  return (
    ((pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || fallback) +
    8
  );
}

function safeFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'pending-datasheets';
}

export function downloadPendingDatasheetModalPdf(
  title: string,
  subtitle: string | undefined,
  rows: DatasheetDrillEntry[],
): void {
  const pdf = buildPendingDatasheetModalPdf(title, subtitle, rows);
  pdf.save(`${safeFilename(title)}.pdf`);
}

export function buildPendingDatasheetModalPdf(
  title: string,
  subtitle: string | undefined,
  rows: DatasheetDrillEntry[],
): jsPDF {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 12;
  let y = 14;

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
  pdf.text('Datasheet Pending — Detail List', pageW - margin, 11, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text(`Generated ${new Date().toLocaleString()}`, pageW - margin, 16, { align: 'right' });

  y = 28;
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
  pdf.text(`${rows.length} matching open task${rows.length === 1 ? '' : 's'}`, margin, y);
  y += 6;

  const body = rows.map((r) => {
    const status = normalizeStatus(r.status) as DatasheetStatus;
    const age =
      r.age_days != null ? `${r.age_days}d${r.is_overdue ? ' (overdue)' : ''}` : '—';
    return [
      r.serial_no,
      r.claim_no || '—',
      r.reg_no || '—',
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
    head: [['Serial', 'Claim', 'Reg.', 'Status', 'Insurer', 'Assessor', 'Age', 'Delay note(s)']],
    body: body.length ? body : [['—', '—', '—', '—', '—', '—', '—', 'No matching records']],
    styles: {
      fontSize: 7,
      cellPadding: 2,
      overflow: 'linebreak',
      valign: 'top',
    },
    headStyles: {
      fillColor: [BRAND.r, BRAND.g, BRAND.b],
      textColor: 255,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 22, fontStyle: 'bold' },
      1: { cellWidth: 24 },
      2: { cellWidth: 22 },
      3: { cellWidth: 26 },
      4: { cellWidth: 32 },
      5: { cellWidth: 28 },
      6: { cellWidth: 16 },
      7: { cellWidth: 'auto' },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 6 && rows[data.row.index]?.is_overdue) {
        data.cell.styles.textColor = [185, 28, 28];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  y = finalY(pdf, y);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  pdf.text(`${COMPANY.contactDetailsLine}`, margin, pdf.internal.pageSize.getHeight() - 8);

  return pdf;
}
