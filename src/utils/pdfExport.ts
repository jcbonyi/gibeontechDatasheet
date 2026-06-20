import jsPDF from 'jspdf';
import {
  CONDITION_ITEMS,
  DASHBOARD_WARNING_LIGHTS,
  DOCUMENT_CHECKLIST,
  DatasheetFormData,
  FORM_TYPES,
} from '@/types/datasheet';
import { COMPANY, LOGO_MARK_PATH } from '@/constants/brand';

const BRAND = { r: 63, g: 61, b: 153 };
const ACCENT = { r: 38, g: 166, b: 154 };
const MUTED = { r: 100, g: 116, b: 139 };
const INK = { r: 30, g: 41, b: 59 };
const LINE = { r: 180, g: 190, b: 200 };

const ML = 9;
const MR = 9;
const PW = 210;
const CW = PW - ML - MR;

async function loadAsset(path: string): Promise<string> {
  const response = await fetch(path);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function clip(text: string, max = 48): string {
  const t = (text || '').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function drawBox(pdf: jsPDF, x: number, y: number, w: number, h: number) {
  pdf.setDrawColor(LINE.r, LINE.g, LINE.b);
  pdf.setLineWidth(0.25);
  pdf.rect(x, y, w, h);
}

const GRID_GAP = 0;
const HEADER_BAND_H = 3.2;

function drawCheckbox(pdf: jsPDF, x: number, y: number, checked: boolean, size = 2.4) {
  pdf.setDrawColor(LINE.r, LINE.g, LINE.b);
  pdf.setLineWidth(0.25);
  pdf.rect(x, y - size + 0.5, size, size);
  if (checked) {
    pdf.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
    pdf.setLineWidth(0.4);
    const top = y - size + 0.5;
    pdf.line(x + 0.45, top + size * 0.52, x + size * 0.38, top + size * 0.82);
    pdf.line(x + size * 0.38, top + size * 0.82, x + size * 0.92, top + size * 0.18);
  }
}

function drawFieldHeader(pdf: jsPDF, x: number, y: number, w: number, label: string) {
  pdf.setFillColor(236, 237, 245);
  pdf.rect(x, y, w, HEADER_BAND_H, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(5.4);
  pdf.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  pdf.text(label.toUpperCase(), x + 0.8, y + 2.2);
}

function fieldBlock(
  pdf: jsPDF,
  x: number,
  y: number,
  w: number,
  label: string,
  value: string,
  h = 7.5,
) {
  drawBox(pdf, x, y, w, h);
  drawFieldHeader(pdf, x, y, w, label);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.2);
  pdf.setTextColor(INK.r, INK.g, INK.b);
  const lines = pdf.splitTextToSize(value || ' ', w - 1.6);
  pdf.text(lines[0] || ' ', x + 0.8, y + HEADER_BAND_H + 2.6);
}

function sectionLabel(pdf: jsPDF, y: number, title: string): number {
  pdf.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  pdf.rect(ML, y, CW, 4.8, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.8);
  pdf.setTextColor(255, 255, 255);
  pdf.text(title.toUpperCase(), ML + 1.5, y + 3.2);
  return y + 5.2;
}

async function drawHeader(
  pdf: jsPDF,
  data: DatasheetFormData,
  serialNo: string,
): Promise<number> {
  let y = 7;
  try {
    const logo = await loadAsset(LOGO_MARK_PATH);
    pdf.addImage(logo, 'PNG', ML, y, 38, 8);
  } catch {
    pdf.setFont('helvetica', 'bolditalic');
    pdf.setFontSize(10);
    pdf.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    pdf.text('GibeonTech', ML, y + 6);
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  pdf.text('DATASHEET', PW - MR, y + 5, { align: 'right' });

  pdf.setFontSize(5.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  pdf.text(`Serial: ${serialNo}`, PW - MR, y + 9, { align: 'right' });

  y += 11;
  const types = FORM_TYPES;
  let cx = ML;
  types.forEach((type) => {
    drawCheckbox(pdf, cx, y + 2.5, data.header.formTypes.includes(type));
    pdf.setFontSize(5.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(INK.r, INK.g, INK.b);
    pdf.text(type.toUpperCase(), cx + 3.5, y + 2.5);
    cx += pdf.getTextWidth(type.toUpperCase()) + 10;
  });

  const dateX = PW - MR - 52;
  fieldBlock(pdf, dateX, y - 1, 24, 'Date', data.header.date, 6.5);
  fieldBlock(pdf, dateX + 26, y - 1, 24, 'Time', data.header.time, 6.5);

  y += 8;
  drawBox(pdf, ML, y, CW, 8);
  drawFieldHeader(pdf, ML, y, CW, 'Documents Provided');
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(5.8);
  pdf.setTextColor(INK.r, INK.g, INK.b);
  const docLines = pdf.splitTextToSize(data.basicInfo.documentsProvided || ' ', CW - 1.6);
  pdf.text(docLines.slice(0, 2).join(' '), ML + 0.8, y + HEADER_BAND_H + 2.4);

  return y + 10;
}

function drawBasicGrid(pdf: jsPDF, data: DatasheetFormData, y: number): number {
  const b = data.basicInfo;
  const gap = GRID_GAP;
  const rowH = 7.5;
  const cols3 = (CW - gap * 2) / 3;
  const cols4 = (CW - gap * 3) / 4;
  const cols5 = (CW - gap * 4) / 5;

  let row = y;
  fieldBlock(pdf, ML, row, cols3, 'Client/Insurer', b.clientInsurer, rowH);
  fieldBlock(pdf, ML + cols3 + gap, row, cols3, 'Owner/Insured', b.ownerInsured, rowH);
  fieldBlock(pdf, ML + (cols3 + gap) * 2, row, cols3, 'Instructed By', b.instructedBy, rowH);
  row += rowH + gap;

  fieldBlock(pdf, ML, row, cols3, 'Policy No.', b.policyNo, rowH);
  fieldBlock(pdf, ML + cols3 + gap, row, cols3, 'Claim No.', b.claimNo, rowH);
  fieldBlock(pdf, ML + (cols3 + gap) * 2, row, cols3, 'Date of Accident', b.dateOfAccident, rowH);
  row += rowH + gap;

  fieldBlock(pdf, ML, row, cols5, 'Reg. No.', b.regNo, rowH);
  fieldBlock(pdf, ML + cols5 + gap, row, cols5, 'Make', b.make, rowH);
  fieldBlock(pdf, ML + (cols5 + gap) * 2, row, cols5, 'Model No.', b.modelNo, rowH);
  fieldBlock(pdf, ML + (cols5 + gap) * 3, row, cols5, 'Year', b.year, rowH);
  fieldBlock(pdf, ML + (cols5 + gap) * 4, row, cols5, "First Re'gd", b.firstRegistered, rowH);
  row += rowH + gap;

  fieldBlock(pdf, ML, row, cols4, 'Chassis No.', b.chassisNo, rowH);
  fieldBlock(pdf, ML + cols4 + gap, row, cols4, 'Engine No.', b.engineNo, rowH);
  fieldBlock(pdf, ML + (cols4 + gap) * 2, row, cols4, 'Sum Insured', b.sumInsured, rowH);
  fieldBlock(pdf, ML + (cols4 + gap) * 3, row, cols4, 'Excess', b.excess, rowH);

  return row + rowH;
}

function drawAssessment(pdf: jsPDF, data: DatasheetFormData, y: number): number {
  y = sectionLabel(pdf, y, 'Assessment');
  const a = data.assessment;
  const gap = GRID_GAP;
  const rowH = 7.5;
  const cols4 = (CW - gap * 3) / 4;
  const cols3 = (CW - gap * 2) / 3;
  const tyreW = (CW - gap * 2) / 3;

  fieldBlock(pdf, ML, y, cols4, 'Origin', a.origin, rowH);
  fieldBlock(pdf, ML + cols4 + gap, y, cols4, 'Body Type', a.bodyType, rowH);
  fieldBlock(pdf, ML + (cols4 + gap) * 2, y, cols4, 'Colour', a.colour, rowH);
  fieldBlock(pdf, ML + (cols4 + gap) * 3, y, cols4, 'Mileage', a.mileage, rowH);
  y += rowH + gap;

  fieldBlock(pdf, ML, y, cols3, 'Engine CC', a.engineCC, rowH);
  fieldBlock(pdf, ML + cols3 + gap, y, cols3, 'Fuel Type', a.fuelType, rowH);
  drawBox(pdf, ML + (cols3 + gap) * 2, y, tyreW, rowH);
  drawFieldHeader(pdf, ML + (cols3 + gap) * 2, y, tyreW, 'Tyres');
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(5.5);
  pdf.setTextColor(INK.r, INK.g, INK.b);
  pdf.text(
    `Brand: ${clip(a.tyreBrand, 12)}  Size: ${clip(a.tyreSize, 10)}  ${a.tyreType || '—'}`,
    ML + (cols3 + gap) * 2 + 0.8,
    y + HEADER_BAND_H + 2.4,
  );

  return y + rowH;
}

function drawConditionGrid(pdf: jsPDF, data: DatasheetFormData, y: number): number {
  y = sectionLabel(pdf, y, 'Vehicle Condition');
  const gap = GRID_GAP;
  const colW = (CW - gap * 2) / 3;
  const rowH = 6.2;
  const cols = 3;

  CONDITION_ITEMS.forEach((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = ML + col * (colW + gap);
    const cy = y + row * rowH;
    drawBox(pdf, x, cy, colW, rowH);
    drawFieldHeader(pdf, x, cy, colW, item);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(5.5);
    pdf.setTextColor(INK.r, INK.g, INK.b);
    pdf.text(clip(data.vehicleCondition[item], 22) || '—', x + 0.8, cy + HEADER_BAND_H + 1.8);
  });

  const rows = Math.ceil(CONDITION_ITEMS.length / cols);
  return y + rows * rowH;
}

function drawDashboardWarningLights(pdf: jsPDF, data: DatasheetFormData, y: number): number {
  const gap = GRID_GAP;
  const boxH = 15;
  y += gap;

  drawBox(pdf, ML, y, CW, boxH);
  drawFieldHeader(pdf, ML, y, CW, 'Dashboard Warning Lights Noted');

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(4.8);
  pdf.setTextColor(INK.r, INK.g, INK.b);

  let dx = ML + 1.5;
  let rowY = y + HEADER_BAND_H + 2.2;
  const maxX = ML + CW - 2;

  DASHBOARD_WARNING_LIGHTS.forEach((light) => {
    const labelW = pdf.getTextWidth(light.label) + 5;
    if (dx + labelW > maxX) {
      dx = ML + 1.5;
      rowY += 3.2;
    }
    drawCheckbox(
      pdf,
      dx,
      rowY,
      data.assessment.dashboardWarningLights?.[light.key] ?? false,
    );
    pdf.text(light.label, dx + 3.2, rowY);
    dx += labelW + 2;
  });

  const notes = data.assessment.dashboardWarningLightsNotes?.trim();
  if (notes) {
    pdf.setFontSize(5);
    pdf.text(`Notes: ${clip(notes, 120)}`, ML + 1.5, rowY + 3.5);
  }

  return y + boxH;
}

function drawVehicleDiagram(
  pdf: jsPDF,
  marks: DatasheetFormData['damage']['vehicleDiagram'],
  x: number,
  y: number,
  w: number,
  h: number,
  diagramImage?: string,
) {
  drawBox(pdf, x, y, w, h);
  if (diagramImage) {
    try {
      pdf.addImage(diagramImage, 'PNG', x + 0.5, y + 0.5, w - 1, h - 1);
    } catch {
      /* fallback */
    }
  }
  pdf.setDrawColor(220, 38, 38);
  pdf.setFillColor(220, 38, 38);
  marks.forEach((mark) => {
    const angle = mark.angle ?? 0;
    const mx = x + 0.5 + (mark.x / 100) * (w - 1);
    const my = y + 0.5 + (mark.y / 100) * (h - 1);
    const rad = (angle * Math.PI) / 180;
    const len = 5;
    pdf.line(mx, my, mx + Math.cos(rad) * len, my + Math.sin(rad) * len);
    pdf.circle(mx, my, 0.5, 'F');
  });
}

function drawDamageSection(
  pdf: jsPDF,
  data: DatasheetFormData,
  y: number,
  diagramImage?: string,
): number {
  const leftW = CW * 0.58;
  const rightW = CW - leftW;
  const boxH = 16;
  const gap = GRID_GAP;

  drawBox(pdf, ML, y, leftW, boxH);
  drawFieldHeader(pdf, ML, y, leftW, 'Damage Summary');
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(5.5);
  pdf.setTextColor(INK.r, INK.g, INK.b);
  pdf.text(pdf.splitTextToSize(data.damage.damageSummary || ' ', leftW - 1.6).slice(0, 3).join(' '), ML + 0.8, y + HEADER_BAND_H + 2.2);

  drawVehicleDiagram(pdf, data.damage.vehicleDiagram, ML + leftW, y, rightW, boxH * 2 + gap, diagramImage);

  const y2 = y + boxH + gap;
  drawBox(pdf, ML, y2, leftW, boxH);
  drawFieldHeader(pdf, ML, y2, leftW, 'Pre-Accident Defects');
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(5.5);
  pdf.text(pdf.splitTextToSize(data.damage.preAccidentDefects || ' ', leftW - 1.6).slice(0, 3).join(' '), ML + 0.8, y2 + HEADER_BAND_H + 2.2);

  const y3 = y2 + boxH + gap;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(5.5);
  pdf.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  pdf.text('HOW DID VEHICLE REACH GARAGE?', ML + 0.8, y3 + 2.5);
  ['Towed', 'Driven', 'Carried'].forEach((opt, i) => {
    const ox = ML + 52 + i * 22;
    drawCheckbox(pdf, ox, y3 + 2.5, data.damage.garageArrival === opt);
    pdf.text(opt.toUpperCase(), ox + 3.5, y3 + 2.5);
  });

  const y4 = y3 + 5 + gap;
  const partW = (CW - gap * 2) / 3;
  const partH = 10;
  const partFields: [string, string][] = [
    ['Parts to be Replaced', data.parts?.toBeReplaced ?? ''],
    ['Parts to be Painted', data.parts?.toBePainted ?? ''],
    ['Parts to be Repaired', data.parts?.toBeRepaired ?? ''],
  ];
  partFields.forEach(([label, value], i) => {
    const x = ML + i * (partW + gap);
    drawBox(pdf, x, y4, partW, partH);
    drawFieldHeader(pdf, x, y4, partW, label);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(5);
    pdf.setTextColor(INK.r, INK.g, INK.b);
    pdf.text(pdf.splitTextToSize(value || ' ', partW - 1.6).slice(0, 2).join(' '), x + 0.8, y4 + HEADER_BAND_H + 2.2);
  });

  return y4 + partH + 2;
}

function drawRemarksAndDocs(pdf: jsPDF, data: DatasheetFormData, y: number): number {
  const gap = GRID_GAP;
  const h = 10;

  drawBox(pdf, ML, y, CW, h);
  drawFieldHeader(pdf, ML, y, CW, 'Remarks');
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(5.3);
  pdf.setTextColor(INK.r, INK.g, INK.b);
  pdf.text(pdf.splitTextToSize(data.remarks || ' ', CW - 1.6).slice(0, 3).join(' '), ML + 0.8, y + HEADER_BAND_H + 2.2);

  y += h + gap;
  drawBox(pdf, ML, y, CW, 7);
  drawFieldHeader(pdf, ML, y, CW, 'Required Documents');
  let dx = ML + 34;
  DOCUMENT_CHECKLIST.forEach((doc) => {
    drawCheckbox(pdf, dx, y + 5.2, data.documents[doc.key].received);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(5);
    pdf.setTextColor(INK.r, INK.g, INK.b);
    pdf.text(doc.label, dx + 3.5, y + 5.2);
    dx += pdf.getTextWidth(doc.label) + 12;
  });

  return y + 9;
}

function drawSignOff(pdf: jsPDF, data: DatasheetFormData, y: number): number {
  const s = data.signOff;
  const gap = GRID_GAP;
  const colW = (CW - gap * 2) / 3;
  const h = 10;

  fieldBlock(pdf, ML, y, colW, 'Repairer / Contact / Phone', `${s.repairerContactPerson} ${s.repairerPhone}`.trim(), h);
  fieldBlock(pdf, ML + colW + gap, y, colW, 'Seen By', s.seenBy, h);
  drawBox(pdf, ML + (colW + gap) * 2, y, colW, h);
  drawFieldHeader(pdf, ML + (colW + gap) * 2, y, colW, 'Date / Time / Signature');
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(5.3);
  pdf.setTextColor(INK.r, INK.g, INK.b);
  pdf.text(clip(s.signatureDateTime, 28), ML + (colW + gap) * 2 + 0.8, y + HEADER_BAND_H + 2.2);
  if (s.assessorSignature) {
    try {
      pdf.addImage(s.assessorSignature, 'PNG', ML + (colW + gap) * 2 + 1, y + 6, colW - 2, 3.5);
    } catch {
      /* ignore */
    }
  }

  y += h + 2;
  pdf.setDrawColor(ACCENT.r, ACCENT.g, ACCENT.b);
  pdf.setLineWidth(0.6);
  pdf.line(ML, y, PW - MR, y);
  pdf.setFontSize(4.5);
  pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  pdf.text(COMPANY.contactDetailsLine, PW / 2, y + 3, { align: 'center' });

  return y + 5;
}

export async function exportDatasheetPdf(data: DatasheetFormData, serialNo: string) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  let diagramImage: string | undefined;
  try {
    diagramImage = await loadAsset('/vehicle-diagram.png');
  } catch {
    diagramImage = undefined;
  }

  let y = await drawHeader(pdf, data, serialNo);
  y = sectionLabel(pdf, y, 'Instructions & Claim Details');
  y = drawBasicGrid(pdf, data, y);
  y = drawAssessment(pdf, data, y);
  y = drawConditionGrid(pdf, data, y);
  y = drawDashboardWarningLights(pdf, data, y);
  y = drawDamageSection(pdf, data, y, diagramImage);
  y = drawRemarksAndDocs(pdf, data, y);
  drawSignOff(pdf, data, y);

  pdf.save(`GibeonTech-Datasheet-${serialNo}.pdf`);
}
