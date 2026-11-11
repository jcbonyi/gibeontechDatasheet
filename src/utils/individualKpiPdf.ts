import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { COMPANY } from '@/constants/brand';
import { STATUS_LABELS, normalizeStatus } from '@/lib/status';
import { formatDisplayDate } from '@/lib/productionConfig';
import {
  formatKpiAmount,
  type IndividualMonthlyKpiResult,
  type TeamOverallKpi,
} from '@/lib/individualMonthlyKpis';

const BRAND = { r: 63, g: 61, b: 153 };
const TEAL = { r: 38, g: 166, b: 154 };
const INK = { r: 30, g: 41, b: 59 };
const MUTED = { r: 100, g: 116, b: 139 };

function safeFilename(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 70) || 'kpi-report'
  );
}

function finalY(pdf: jsPDF, fallback: number): number {
  return (
    ((pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || fallback) +
    6
  );
}

function drawHeader(pdf: jsPDF, reportLabel: string): number {
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
  pdf.setFontSize(11);
  pdf.text(reportLabel, pageW - margin, 11, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text(`Generated ${new Date().toLocaleString()}`, pageW - margin, 16, { align: 'right' });
  return 28;
}

function drawFooter(pdf: jsPDF): void {
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    pdf.text(COMPANY.contactDetailsLine, 12, pdf.internal.pageSize.getHeight() - 8);
    pdf.text(`Page ${i} of ${pageCount}`, pdf.internal.pageSize.getWidth() - 12, pdf.internal.pageSize.getHeight() - 8, {
      align: 'right',
    });
  }
}

function ensureSpace(pdf: jsPDF, y: number, need: number): number {
  const pageH = pdf.internal.pageSize.getHeight();
  if (y + need < pageH - 16) return y;
  pdf.addPage();
  return 16;
}

function sectionTitle(pdf: jsPDF, y: number, text: string): number {
  y = ensureSpace(pdf, y, 10);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  pdf.text(text, 12, y);
  return y + 3;
}

function statusLabel(raw: string): string {
  try {
    return STATUS_LABELS[normalizeStatus(raw)] || raw;
  } catch {
    return raw;
  }
}

function personRows(people: IndividualMonthlyKpiResult[]) {
  return people.map((p) => [
    p.label,
    p.targetSeen != null ? String(p.seenJobs) : '—',
    p.targetSeen != null ? String(p.targetSeen) : '—',
    p.seenPct != null ? `${p.seenPct}%` : '—',
    formatKpiAmount(p.doneAmount),
    formatKpiAmount(p.targetAmount),
    `${p.amountPct}%`,
    String(p.pendingJobs),
    p.amountMet && (p.seenMet === null || p.seenMet) ? 'On target' : 'In progress',
  ]);
}

function drawPersonDetails(pdf: jsPDF, y: number, person: IndividualMonthlyKpiResult): number {
  const margin = 12;
  y = ensureSpace(pdf, y, 16);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(INK.r, INK.g, INK.b);
  pdf.text(person.label, margin, y);
  y += 5;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  const summaryBits = [
    person.targetSeen != null
      ? `Seen ${person.seenJobs}/${person.targetSeen} (${person.seenPct}%)`
      : null,
    `Done By ${formatKpiAmount(person.doneAmount)}/${formatKpiAmount(person.targetAmount)} (${person.amountPct}%)`,
    `Pending ${person.pendingJobs}`,
  ].filter(Boolean);
  pdf.text(summaryBits.join('  ·  '), margin, y);
  y += 4;

  if (person.seenLines.length) {
    y = sectionTitle(
      pdf,
      y,
      `Seen By instructions (${person.seenLines.length}) — registration / insurer / value`,
    );
    autoTable(pdf, {
      startY: y,
      margin: { left: margin, right: margin, top: 14, bottom: 14 },
      head: [['Date', 'Registration', 'Insurer', 'Insured', 'Assignment', 'Value']],
      body: person.seenLines.map((l) => [
        l.date ? formatDisplayDate(l.date) : '—',
        l.registration,
        l.insurer,
        l.insured,
        l.assignment,
        formatKpiAmount(l.amount),
      ]),
      styles: { fontSize: 7, cellPadding: 1.2 },
      headStyles: { fillColor: [TEAL.r, TEAL.g, TEAL.b], textColor: 255 },
      alternateRowStyles: { fillColor: [240, 253, 250] },
    });
    y = finalY(pdf, y);
  }

  if (person.doneLines.length) {
    y = sectionTitle(
      pdf,
      y,
      `Done By production (${person.doneLines.length}) — registration / insurer / value`,
    );
    autoTable(pdf, {
      startY: y,
      margin: { left: margin, right: margin, top: 14, bottom: 14 },
      head: [['Date', 'Registration', 'Insurer', 'Insured', 'Assignment', 'Value']],
      body: person.doneLines.map((l) => [
        l.date ? formatDisplayDate(l.date) : '—',
        l.registration,
        l.insurer,
        l.insured,
        l.assignment,
        formatKpiAmount(l.amount),
      ]),
      styles: { fontSize: 7, cellPadding: 1.2 },
      headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    y = finalY(pdf, y);
  }

  if (person.pendingLines.length) {
    y = sectionTitle(
      pdf,
      y,
      `Pending jobs now (${person.pendingLines.length}) — registration / garage / status`,
    );
    autoTable(pdf, {
      startY: y,
      margin: { left: margin, right: margin, top: 14, bottom: 14 },
      head: [['Serial', 'Registration', 'Claim', 'Insurer', 'Garage / Repairer', 'Status']],
      body: person.pendingLines.map((l) => [
        l.serial,
        l.registration,
        l.claim,
        l.insurer,
        l.garage,
        statusLabel(l.status),
      ]),
      styles: { fontSize: 7, cellPadding: 1.2 },
      headStyles: { fillColor: [180, 83, 9], textColor: 255 },
      alternateRowStyles: { fillColor: [255, 251, 235] },
    });
    y = finalY(pdf, y);
  }

  if (!person.seenLines.length && !person.doneLines.length && !person.pendingLines.length) {
    y = ensureSpace(pdf, y, 8);
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8);
    pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    pdf.text('No Seen, Done By, or pending line items for this period.', margin, y);
    y += 6;
  }

  return y + 4;
}

export type IndividualKpiPdfInput = {
  title: string;
  subtitle: string;
  scope: 'team' | 'individual';
  people: IndividualMonthlyKpiResult[];
  overall?: TeamOverallKpi | null;
};

export function buildIndividualKpiPdf(input: IndividualKpiPdfInput): jsPDF {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 12;
  let y = drawHeader(pdf, 'Assessment Tracker — Monthly KPI');

  pdf.setTextColor(INK.r, INK.g, INK.b);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text(input.title, margin, y);
  y += 5;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  pdf.text(input.subtitle, margin, y);
  y += 7;

  if (input.overall && input.scope === 'team') {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    pdf.text('Overall team performance (sum of individual targets)', margin, y);
    y += 4;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(INK.r, INK.g, INK.b);
    const o = input.overall;
    const lines = [
      `Done By value: ${formatKpiAmount(o.doneAmount)} / ${formatKpiAmount(o.targetAmount)} (${o.amountPct}%)`,
      o.seenPct != null
        ? `Seen instructions: ${o.seenJobs} / ${o.targetSeen} (${o.seenPct}%)`
        : null,
      `Pending jobs (open assigned tasks): ${o.pendingJobs}`,
      `People on value target: ${o.peopleOnAmountTarget} / ${o.peopleCount}` +
        (o.targetSeen > 0 ? ` · People on seen target: ${o.peopleOnSeenTarget}` : ''),
    ].filter(Boolean) as string[];
    for (const line of lines) {
      pdf.text(line, margin, y);
      y += 4;
    }
    y += 2;
  }

  autoTable(pdf, {
    startY: y,
    margin: { left: margin, right: margin, top: margin, bottom: 14 },
    head: [
      [
        'Person',
        'Seen',
        'Seen tgt',
        'Seen %',
        'Done By value',
        'Value tgt',
        'Value %',
        'Pending',
        'Status',
      ],
    ],
    body: personRows(input.people),
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
  y = finalY(pdf, y) + 2;

  pdf.addPage();
  y = 16;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(INK.r, INK.g, INK.b);
  pdf.text('Detailed line items', margin, y);
  y += 6;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  pdf.text(
    'Seen By / Done By from Production (registration, insurer, value). Pending from open Assessment tasks (registration, garage/repairer).',
    margin,
    y,
  );
  y += 6;

  for (const person of input.people) {
    y = drawPersonDetails(pdf, y, person);
  }

  drawFooter(pdf);
  return pdf;
}

export function downloadIndividualKpiPdf(input: IndividualKpiPdfInput): void {
  const pdf = buildIndividualKpiPdf(input);
  pdf.save(`${safeFilename(input.title)}.pdf`);
}
