import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AnalyticsSummary } from '@/lib/tracking';
import { SLA_DAYS } from '@/lib/tracking';
import { STATUS_LABELS } from '@/lib/status';
import { COMPANY } from '@/constants/brand';

const BRAND = { r: 63, g: 61, b: 153 };
const INK = { r: 30, g: 41, b: 59 };
const MUTED = { r: 100, g: 116, b: 139 };

function finalY(pdf: jsPDF, fallback: number): number {
  return ((pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ||
    fallback) + 8;
}

export function buildAnalyticsReportDoc(
  summary: AnalyticsSummary,
  filters: { fromDate?: string; toDate?: string },
): jsPDF {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const ML = 14;
  let y = 16;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  pdf.text(COMPANY.shortName, ML, y);
  y += 6;
  pdf.setFontSize(11);
  pdf.setTextColor(INK.r, INK.g, INK.b);
  pdf.text('Operations Analytics Report', ML, y);
  y += 5;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  const period =
    filters.fromDate || filters.toDate
      ? `Period: ${filters.fromDate || '…'} → ${filters.toDate || '…'}`
      : 'Period: All dates';
  pdf.text(`${period}  ·  Generated ${new Date().toLocaleString()}`, ML, y);
  pdf.text(`Ageing from Date of Instruction  ·  SLA ${SLA_DAYS} days`, ML, y + 4);
  y += 12;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  pdf.text('Key performance indicators', ML, y);

  autoTable(pdf, {
    startY: y + 2,
    margin: { left: ML, right: ML },
    head: [['Metric', 'Value']],
    body: [
      ['Total datasheets', String(summary.kpis.total)],
      ['Open (not approved)', String(summary.kpis.open)],
      [`Overdue (>${SLA_DAYS} days)`, String(summary.kpis.overdue)],
      ['Avg open age (days)', summary.kpis.avgAgeDays != null ? String(summary.kpis.avgAgeDays) : '—'],
      ['SLA compliance %', summary.kpis.slaCompliancePct != null ? String(summary.kpis.slaCompliancePct) : '—'],
      ['Approved (in filter)', String(summary.kpis.approvedInPeriod)],
      [
        'Avg Instructed→Issued (days)',
        summary.cycleTime?.avgInstructedToIssuedDays != null
          ? String(summary.cycleTime.avgInstructedToIssuedDays)
          : '—',
      ],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b] },
  });

  y = finalY(pdf, y);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  pdf.text('Status breakdown', ML, y);
  autoTable(pdf, {
    startY: y + 2,
    margin: { left: ML, right: ML },
    head: [['Status', 'Count']],
    body: summary.byStatus.map((r) => [STATUS_LABELS[r.status] || r.status, String(r.count)]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b] },
  });

  y = finalY(pdf, y);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  pdf.text('Ageing (from Date of Instruction)', ML, y);
  autoTable(pdf, {
    startY: y + 2,
    margin: { left: ML, right: ML },
    head: [['Age band', 'Count']],
    body: summary.byAgeBand.map((r) => [r.label, String(r.count)]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b] },
  });

  y = finalY(pdf, y);

  if (y > 240) {
    pdf.addPage();
    y = 16;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  pdf.text('Assessor workload', ML, y);
  autoTable(pdf, {
    startY: y + 2,
    margin: { left: ML, right: ML },
    head: [['Assessor', 'Total', 'Open', 'Overdue', 'Avg age']],
    body: summary.byAssessor.slice(0, 15).map((r) => [
      r.name,
      String(r.total),
      String(r.open),
      String(r.overdue),
      r.avgAgeDays != null ? String(r.avgAgeDays) : '—',
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b] },
  });

  y = finalY(pdf, y);

  if (y > 220) {
    pdf.addPage();
    y = 16;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  pdf.text('Open ageing queue (oldest first)', ML, y);
  autoTable(pdf, {
    startY: y + 2,
    margin: { left: ML, right: ML },
    head: [['Serial', 'Claim', 'Reg', 'Status', 'Instruction', 'Age', 'Assessor']],
    body: summary.agingQueue.map((r) => [
      r.serial_no,
      r.claim_no || '—',
      r.reg_no || '—',
      STATUS_LABELS[r.status] || r.status,
      r.date_of_instruction || '—',
      r.age_days != null ? String(r.age_days) : '—',
      r.assigned_to_name || '—',
    ]),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b] },
  });

  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7);
    pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    pdf.text(`${COMPANY.name} · Confidential · Page ${i}/${pageCount}`, ML, 287);
  }

  return pdf;
}

export function analyticsReportToBuffer(
  summary: AnalyticsSummary,
  filters: { fromDate?: string; toDate?: string },
): Buffer {
  return Buffer.from(buildAnalyticsReportDoc(summary, filters).output('arraybuffer'));
}
