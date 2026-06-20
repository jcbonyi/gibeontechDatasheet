import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  InspectionFormData,
  SYSTEMS_INSPECTION_GROUPS,
  COACHWORK_ITEMS,
  BODY_ITEMS,
  PHOTO_FIELDS,
  BODY_DAMAGE_LABELS,
  formatRating,
  getInspectionItem,
  ConditionRating,
} from '../types/inspection';
import { COMPANY, LOGO_MARK_PATH } from '../constants/brand';

const PDF_PHOTO_COLS = 2;
const PDF_PHOTO_ROWS_PER_PAGE = 6;

async function loadLetterheadImage(): Promise<string> {
  const response = await fetch(LOGO_MARK_PATH);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const BRAND = { r: 63, g: 61, b: 153 }; // #3F3D99
const BRAND_LIGHT = { r: 75, g: 73, b: 158 }; // #4B499E
const ACCENT = { r: 38, g: 166, b: 154 }; // #26A69A
const DARK = { r: 30, g: 41, b: 59 };
const MUTED = { r: 100, g: 116, b: 139 };

function ratingColor(rating: ConditionRating): [number, number, number] {
  switch (rating) {
    case 'excellent': return [5, 150, 105];
    case 'good': return [38, 166, 154];
    case 'fair': return [217, 119, 6];
    case 'poor': return [220, 38, 38];
    case 'na': return [100, 116, 139];
    default: return [148, 163, 184];
  }
}

async function addLetterhead(pdf: jsPDF, reportId: string, reportDate: string, reportTime: string): Promise<number> {
  const logoData = await loadLetterheadImage();
  const pageCenter = 105;
  const leftX = 14;
  const contactLineHeight = 3.2;

  // Report meta (top right)
  pdf.setFontSize(7);
  pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Report ID', 196, 10, { align: 'right' });
  pdf.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text(reportId, 196, 14, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  pdf.setFontSize(7);
  pdf.text(`Date: ${reportDate}  ·  Time: ${reportTime}`, 196, 18, { align: 'right' });

  // Left block: mark + company name + contacts (all left-aligned, line-height 1)
  let y = 8;
  const logoW = 58;
  const logoH = 11;
  try {
    pdf.addImage(logoData, 'PNG', leftX, y, logoW, logoH);
  } catch {
    pdf.setTextColor(BRAND.r, BRAND.g, BRAND.b);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bolditalic');
    pdf.text('GibeonTech', leftX, y + 7);
  }
  y += logoH + 2;

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  pdf.text(COMPANY.name, leftX, y, { align: 'left' });
  y += contactLineHeight + 0.5;

  pdf.setFontSize(6.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  pdf.text(COMPANY.contactAddressLine, leftX, y, { align: 'left' });
  y += contactLineHeight;
  pdf.text(COMPANY.contactDetailsLine, leftX, y, { align: 'left' });
  y += contactLineHeight + 4;

  // Centered report title below the letterhead block
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  pdf.text(COMPANY.reportTitle.toUpperCase(), pageCenter, y, { align: 'center' });
  y += 5;

  // Teal accent rule
  pdf.setDrawColor(ACCENT.r, ACCENT.g, ACCENT.b);
  pdf.setLineWidth(1.2);
  pdf.line(14, y, 196, y);
  // Purple fade line below
  pdf.setDrawColor(BRAND_LIGHT.r, BRAND_LIGHT.g, BRAND_LIGHT.b);
  pdf.setLineWidth(0.4);
  pdf.line(14, y + 1, 196, y + 1);

  return y + 6;
}

function addPageFooter(pdf: jsPDF, pageNum: number, pageCount: number) {
  pdf.setDrawColor(ACCENT.r, ACCENT.g, ACCENT.b);
  pdf.setLineWidth(0.3);
  pdf.line(14, 283, 196, 283);

  pdf.setFontSize(6);
  pdf.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  pdf.setFont('helvetica', 'bold');
  pdf.text(COMPANY.name, 105, 287, { align: 'center' });

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  pdf.setFontSize(5.5);
  const footerContact = `${COMPANY.email} · ${COMPANY.website} · ${COMPANY.phones}`;
  pdf.text(footerContact, 105, 290.5, { align: 'center' });
  pdf.text(`Page ${pageNum} of ${pageCount} · Confidential`, 196, 290.5, { align: 'right' });
}

function addSectionTitle(pdf: jsPDF, title: string, y: number): number {
  if (y > 258) {
    pdf.addPage();
    y = 20;
  }
  pdf.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title.toUpperCase(), 14, y);
  pdf.setDrawColor(ACCENT.r, ACCENT.g, ACCENT.b);
  pdf.setLineWidth(0.6);
  pdf.line(14, y + 1.5, 80, y + 1.5);
  return y + 7;
}

function addInspectionTable(
  pdf: jsPDF,
  title: string,
  items: readonly string[],
  sectionData: Record<string, { rating: ConditionRating; remarks: string }>,
  startY: number,
  remarks?: string,
): number {
  let y = addSectionTitle(pdf, title, startY);

  const body = items.map((item) => {
    const entry = getInspectionItem(sectionData, item);
    return [item, formatRating(entry?.rating ?? ''), entry?.remarks || '—'];
  });

  autoTable(pdf, {
    startY: y,
    head: [['Item', 'Rating', 'Remarks']],
    body,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 7.5, cellPadding: 2.5, textColor: [DARK.r, DARK.g, DARK.b] },
    headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 28, halign: 'center' },
      2: { cellWidth: 'auto' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const rating = items[data.row.index]
          ? getInspectionItem(sectionData, items[data.row.index])?.rating
          : '';
        const [r, g, b] = ratingColor(rating ?? '');
        data.cell.styles.textColor = [r, g, b];
        data.cell.styles.fontStyle = rating ? 'bold' : 'normal';
      }
    },
  });

  y = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  if (remarks) {
    pdf.setFontSize(7.5);
    pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Remarks: ', 14, y);
    pdf.setFont('helvetica', 'normal');
    const lines = pdf.splitTextToSize(remarks, 180);
    pdf.text(lines, 14 + pdf.getTextWidth('Remarks: '), y);
    y += lines.length * 3.5 + 4;
  }

  return y + 4;
}

async function addImageToPdf(pdf: jsPDF, dataUrl: string, x: number, y: number, w: number, h: number) {
  try {
    pdf.addImage(dataUrl, 'JPEG', x, y, w, h);
  } catch {
    pdf.setFillColor(241, 245, 249);
    pdf.rect(x, y, w, h, 'F');
    pdf.setFontSize(7);
    pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    pdf.text('Image unavailable', x + w / 2, y + h / 2, { align: 'center' });
  }
}

export async function exportToPdf(data: InspectionFormData): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const vd = data.vehicleDetails;
  const reportId = `MVI-${vd.registrationNumber.replace(/\s/g, '')}-${vd.inspectionDate.replace(/-/g, '')}`;

  let y = await addLetterhead(pdf, reportId, vd.inspectionDate, vd.inspectionTime);

  // Executive summary
  const isRoadworthy = data.findings.roadworthy === 'yes';
  pdf.setFillColor(isRoadworthy ? 236 : 254, isRoadworthy ? 253 : 242, isRoadworthy ? 245 : 242);
  pdf.roundedRect(14, y, 182, 20, 2, 2, 'F');
  pdf.setDrawColor(isRoadworthy ? ACCENT.r : 220, isRoadworthy ? ACCENT.g : 38, isRoadworthy ? ACCENT.b : 38);
  pdf.setLineWidth(0.6);
  pdf.roundedRect(14, y, 182, 20, 2, 2, 'S');

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(isRoadworthy ? ACCENT.r : 220, isRoadworthy ? ACCENT.g : 38, isRoadworthy ? ACCENT.b : 38);
  pdf.text(isRoadworthy ? 'VEHICLE DECLARED ROADWORTHY' : 'VEHICLE NOT ROADWORTHY', 20, y + 8);

  pdf.setFontSize(8.5);
  pdf.setTextColor(DARK.r, DARK.g, DARK.b);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${vd.yearOfManufacture} ${vd.make} ${vd.model}  ·  ${vd.registrationNumber}`, 20, y + 14);
  pdf.text(`Overall: ${formatRating(data.generalCondition.rating)}  ·  Odometer: ${Number(vd.odometerReading).toLocaleString()} KM`, 20, y + 18);

  y += 26;

  // Vehicle details
  y = addSectionTitle(pdf, 'Vehicle & Owner Details', y);

  autoTable(pdf, {
    startY: y,
    body: [
      ['Registration', vd.registrationNumber, 'Make / Model', `${vd.make} ${vd.model}`],
      ['Year', vd.yearOfManufacture, 'Engine No.', vd.engineNumber],
      ['Engine CC', vd.engineCC ? `${vd.engineCC} cc` : '—', 'Chassis / VIN', vd.chassisVin],
      ['Fuel Type', vd.fuelType, 'Color', vd.vehicleColor],
      ['Seating', vd.seatingCapacity, 'Usage', vd.vehicleUsage],
      ['Inspector', vd.inspectorName, 'Owner', vd.ownerName],
      ['Contact', vd.ownerContact, 'Insurance', vd.insuranceCompany || '—'],
      ['Policy No.', vd.policyNumber || '—', 'Location', vd.inspectionLocation],
      ['Date / Time', `${vd.inspectionDate} ${vd.inspectionTime}`, '', ''],
    ],
    theme: 'plain',
    margin: { left: 14, right: 14 },
    styles: { fontSize: 7.5, cellPadding: 2.5, textColor: [DARK.r, DARK.g, DARK.b] },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: [MUTED.r, MUTED.g, MUTED.b], cellWidth: 32 },
      1: { cellWidth: 55 },
      2: { fontStyle: 'bold', textColor: [MUTED.r, MUTED.g, MUTED.b], cellWidth: 32 },
      3: { cellWidth: 'auto' },
    },
  });

  y = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  if (y > 240) { pdf.addPage(); y = 20; }
  y = addSectionTitle(pdf, 'Systems Inspection', y);

  for (const group of SYSTEMS_INSPECTION_GROUPS) {
    y = addInspectionTable(pdf, group.label, group.items, data[group.dataKey], y, data[group.remarksKey]);
    if (y > 250) { pdf.addPage(); y = 20; }
  }

  if (y > 230) { pdf.addPage(); y = 20; }
  y = addSectionTitle(pdf, 'Exterior & Interior Condition', y);
  y = addInspectionTable(pdf, 'Interior & Upholstery', COACHWORK_ITEMS, data.coachwork, y, data.coachworkRemarks);
  y = addInspectionTable(pdf, 'Body Panels', BODY_ITEMS, data.bodyCondition, y, data.bodyRemarks);

  const damageEntries = Object.entries(data.bodyDamage).filter(([, v]) => v);
  if (damageEntries.length > 0) {
    y = addSectionTitle(pdf, 'Damage Assessment', y);
    autoTable(pdf, {
      startY: y,
      body: damageEntries.map(([k, v]) => [BODY_DAMAGE_LABELS[k as keyof typeof BODY_DAMAGE_LABELS], v]),
      margin: { left: 14, right: 14 },
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45, textColor: [MUTED.r, MUTED.g, MUTED.b] } },
    });
    y = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  if (y > 240) { pdf.addPage(); y = 20; }
  y = addSectionTitle(pdf, 'Assessment & Conclusion', y);

  autoTable(pdf, {
    startY: y,
    body: [
      ['Roadworthy', data.findings.roadworthy === 'yes' ? 'Yes' : 'No'],
      ['Pre-existing Damage', data.findings.preExistingDamage === 'yes' ? 'Yes' : 'No'],
      ['Repairs Recommended', data.findings.repairsRecommended === 'yes' ? 'Yes' : 'No'],
      ...(data.findings.estimatedRepairCost ? [['Est. Repair Cost', data.findings.estimatedRepairCost]] : []),
    ],
    theme: 'plain',
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50, textColor: [MUTED.r, MUTED.g, MUTED.b] } },
  });

  y = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  if (data.findings.additionalObservations) {
    pdf.setFontSize(7.5);
    pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    pdf.text('Additional Observations:', 14, y);
    y += 4;
    pdf.setTextColor(DARK.r, DARK.g, DARK.b);
    const lines = pdf.splitTextToSize(data.findings.additionalObservations, 180);
    pdf.text(lines, 14, y);
    y += lines.length * 3.5 + 8;
  }

  const photos = PHOTO_FIELDS.filter(({ key }) => data.photos[key]);
  if (photos.length > 0) {
    const pageMargin = 14;
    const contentWidth = 182;
    const colGap = 8;
    const imgW = (contentWidth - colGap) / PDF_PHOTO_COLS;
    const imgH = 32;
    const captionH = 5;
    const rowGap = 5;
    const rowStride = imgH + captionH + rowGap;
    const photosPerPage = PDF_PHOTO_COLS * PDF_PHOTO_ROWS_PER_PAGE;

    let gridStartY = 0;

    for (let i = 0; i < photos.length; i++) {
      const indexOnPage = i % photosPerPage;

      if (indexOnPage === 0) {
        pdf.addPage();
        const title = i === 0 ? 'Photographic Evidence' : 'Photographic Evidence (continued)';
        gridStartY = addSectionTitle(pdf, title, 20);
      }

      const col = indexOnPage % PDF_PHOTO_COLS;
      const row = Math.floor(indexOnPage / PDF_PHOTO_COLS);
      const x = pageMargin + col * (imgW + colGap);
      const rowY = gridStartY + row * rowStride;
      const { key, label } = photos[i];

      await addImageToPdf(pdf, data.photos[key], x, rowY, imgW, imgH);
      pdf.setFillColor(BRAND.r, BRAND.g, BRAND.b);
      pdf.rect(x, rowY + imgH, imgW, captionH, 'F');
      pdf.setFontSize(6);
      pdf.setTextColor(255, 255, 255);
      pdf.text(label, x + 2, rowY + imgH + 3.5);
    }

    y = gridStartY + PDF_PHOTO_ROWS_PER_PAGE * rowStride;
  }

  if (y > 230) { pdf.addPage(); y = 20; }
  y = addSectionTitle(pdf, 'Declaration & Sign-off', y);

  pdf.setFontSize(7.5);
  pdf.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  pdf.setFont('helvetica', 'italic');
  const declText = 'I certify that the above inspection was conducted physically and the findings recorded represent the condition of the vehicle at the time of inspection.';
  pdf.text(pdf.splitTextToSize(declText, 180), 14, y);
  y += 14;

  autoTable(pdf, {
    startY: y,
    body: [
      ['Inspector', vd.inspectorName, data.declaration.inspectorSignature, data.declaration.inspectorDate],
      ['Owner / Representative', vd.ownerName, data.declaration.ownerSignature, data.declaration.ownerDate],
    ],
    head: [['Role', 'Name', 'Signature', 'Date']],
    margin: { left: 14, right: 14 },
    styles: { fontSize: 7.5, cellPadding: 4 },
    headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255 },
    columnStyles: { 2: { fontStyle: 'italic' } },
  });

  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    addPageFooter(pdf, i, pageCount);
  }

  const filename = `Inspection_${vd.registrationNumber.replace(/\s/g, '_')}_${vd.inspectionDate}.pdf`;
  pdf.save(filename);
}
