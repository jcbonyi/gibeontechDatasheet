import ExcelJS from 'exceljs';
import type { AnalyticsSummary, DatasheetListItem } from '@/lib/tracking';
import { AGE_BAND_LABELS, SLA_DAYS } from '@/lib/tracking';

function statusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

export async function buildRegisterWorkbook(rows: DatasheetListItem[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'GibeonTech Datasheet';
  wb.created = new Date();

  const sheet = wb.addWorksheet('Register', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = [
    { header: 'Serial', key: 'serial', width: 16 },
    { header: 'Claim No', key: 'claim', width: 14 },
    { header: 'Reg No', key: 'reg', width: 12 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Client/Insurer', key: 'insurer', width: 22 },
    { header: 'Form Types', key: 'forms', width: 22 },
    { header: 'Date of Instruction', key: 'instruction', width: 18 },
    { header: 'Age (days)', key: 'age', width: 12 },
    { header: 'Age Band', key: 'band', width: 16 },
    { header: 'Overdue', key: 'overdue', width: 10 },
    { header: 'Created By', key: 'createdBy', width: 18 },
    { header: 'Assigned To', key: 'assignedTo', width: 18 },
    { header: 'Created', key: 'created', width: 20 },
    { header: 'Updated', key: 'updated', width: 20 },
  ];

  styleHeader(sheet);

  rows.forEach((r) => {
    const row = sheet.addRow({
      serial: r.serial_no,
      claim: r.claim_no || '',
      reg: r.reg_no || '',
      status: statusLabel(r.status),
      insurer: r.client_insurer || '',
      forms: r.form_types.join(', '),
      instruction: r.date_of_instruction || '',
      age: r.age_days ?? '',
      band: AGE_BAND_LABELS[r.age_band],
      overdue: r.is_overdue ? 'Yes' : 'No',
      createdBy: r.created_by_name || '',
      assignedTo: r.assigned_to_name || '',
      created: r.created_at,
      updated: r.updated_at,
    });
    if (r.is_overdue) {
      row.getCell('overdue').font = { color: { argb: 'FFB91C1C' }, bold: true };
      row.getCell('age').font = { color: { argb: 'FFB91C1C' }, bold: true };
    }
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function buildOpsWorkbook(
  rows: DatasheetListItem[],
  summary: AnalyticsSummary,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'GibeonTech Datasheet';
  wb.created = new Date();

  const kpis = wb.addWorksheet('KPIs');
  kpis.columns = [
    { header: 'Metric', key: 'metric', width: 28 },
    { header: 'Value', key: 'value', width: 16 },
  ];
  styleHeader(kpis);
  kpis.addRow({ metric: 'Total datasheets', value: summary.kpis.total });
  kpis.addRow({ metric: 'Open (not approved)', value: summary.kpis.open });
  kpis.addRow({ metric: `Overdue (>${SLA_DAYS} days from instruction)`, value: summary.kpis.overdue });
  kpis.addRow({ metric: 'Avg open age (days)', value: summary.kpis.avgAgeDays ?? '—' });
  kpis.addRow({ metric: 'Approved (in filter)', value: summary.kpis.approvedInPeriod });

  const statusSheet = wb.addWorksheet('By Status');
  statusSheet.columns = [
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Count', key: 'count', width: 10 },
  ];
  styleHeader(statusSheet);
  summary.byStatus.forEach((r) => statusSheet.addRow({ status: statusLabel(r.status), count: r.count }));

  const ageSheet = wb.addWorksheet('Ageing');
  ageSheet.columns = [
    { header: 'Age Band', key: 'band', width: 20 },
    { header: 'Count', key: 'count', width: 10 },
  ];
  styleHeader(ageSheet);
  summary.byAgeBand.forEach((r) => ageSheet.addRow({ band: r.label, count: r.count }));

  const assessorSheet = wb.addWorksheet('By Assessor');
  assessorSheet.columns = [
    { header: 'Assessor', key: 'name', width: 22 },
    { header: 'Total', key: 'total', width: 10 },
    { header: 'Open', key: 'open', width: 10 },
    { header: 'Overdue', key: 'overdue', width: 10 },
    { header: 'Avg Age (days)', key: 'avg', width: 14 },
  ];
  styleHeader(assessorSheet);
  summary.byAssessor.forEach((r) =>
    assessorSheet.addRow({
      name: r.name,
      total: r.total,
      open: r.open,
      overdue: r.overdue,
      avg: r.avgAgeDays ?? '',
    }),
  );

  const insurerSheet = wb.addWorksheet('By Insurer');
  insurerSheet.columns = [
    { header: 'Client/Insurer', key: 'name', width: 28 },
    { header: 'Count', key: 'count', width: 10 },
  ];
  styleHeader(insurerSheet);
  summary.byInsurer.forEach((r) => insurerSheet.addRow({ name: r.name, count: r.count }));

  const register = wb.addWorksheet('Register', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  register.columns = [
    { header: 'Serial', key: 'serial', width: 16 },
    { header: 'Claim No', key: 'claim', width: 14 },
    { header: 'Reg No', key: 'reg', width: 12 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Client/Insurer', key: 'insurer', width: 22 },
    { header: 'Date of Instruction', key: 'instruction', width: 18 },
    { header: 'Age (days)', key: 'age', width: 12 },
    { header: 'Age Band', key: 'band', width: 16 },
    { header: 'Overdue', key: 'overdue', width: 10 },
    { header: 'Assigned To', key: 'assignedTo', width: 18 },
    { header: 'Updated', key: 'updated', width: 20 },
  ];
  styleHeader(register);
  rows.forEach((r) => {
    register.addRow({
      serial: r.serial_no,
      claim: r.claim_no || '',
      reg: r.reg_no || '',
      status: statusLabel(r.status),
      insurer: r.client_insurer || '',
      instruction: r.date_of_instruction || '',
      age: r.age_days ?? '',
      band: AGE_BAND_LABELS[r.age_band],
      overdue: r.is_overdue ? 'Yes' : 'No',
      assignedTo: r.assigned_to_name || '',
      updated: r.updated_at,
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

function styleHeader(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF3F3D99' },
  };
  header.alignment = { vertical: 'middle' };
}
