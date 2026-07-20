import type { DatasheetStatus, FormType } from '@/types/datasheet';
import type { DbDatasheetListRow } from '@/lib/db';

export type AgeBand = '0-3' | '4-7' | '8-14' | '15+' | 'unknown';

export const AGE_BANDS: AgeBand[] = ['0-3', '4-7', '8-14', '15+', 'unknown'];

export const AGE_BAND_LABELS: Record<AgeBand, string> = {
  '0-3': '0–3 days',
  '4-7': '4–7 days',
  '8-14': '8–14 days',
  '15+': '15+ days',
  unknown: 'No instruction date',
};

/** Open items older than this many days are flagged overdue. */
export const SLA_DAYS = 7;

export interface TrackingFields {
  date_of_instruction: string | null;
  client_insurer: string | null;
  form_types: FormType[];
  age_days: number | null;
  age_band: AgeBand;
  is_overdue: boolean;
}

export interface DatasheetListItem
  extends Omit<DbDatasheetListRow, 'form_data'>,
    TrackingFields {}

export interface AnalyticsSummary {
  kpis: {
    total: number;
    open: number;
    overdue: number;
    avgAgeDays: number | null;
    approvedInPeriod: number;
  };
  byStatus: { status: DatasheetStatus; count: number }[];
  byAgeBand: { band: AgeBand; label: string; count: number }[];
  byAssessor: { name: string; total: number; open: number; overdue: number; avgAgeDays: number | null }[];
  byInsurer: { name: string; count: number }[];
  byFormType: { type: string; count: number }[];
  volumeByMonth: { month: string; created: number; approved: number }[];
  agingQueue: {
    id: number;
    serial_no: string;
    claim_no: string | null;
    reg_no: string | null;
    status: DatasheetStatus;
    client_insurer: string | null;
    assigned_to_name: string | null;
    date_of_instruction: string | null;
    age_days: number | null;
    age_band: AgeBand;
  }[];
}

function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const d = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function calcAgeDays(dateOfInstruction: string | null | undefined, asOf = new Date()): number | null {
  const start = parseDateOnly(dateOfInstruction);
  if (!start) return null;
  const diff = startOfDay(asOf).getTime() - startOfDay(start).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function ageBandFromDays(days: number | null): AgeBand {
  if (days === null) return 'unknown';
  if (days <= 3) return '0-3';
  if (days <= 7) return '4-7';
  if (days <= 14) return '8-14';
  return '15+';
}

export function extractTrackingFields(
  formData: Record<string, unknown> | null | undefined,
  status: DatasheetStatus,
  asOf = new Date(),
): TrackingFields {
  const basic = (formData?.basicInfo || {}) as Record<string, string>;
  const header = (formData?.header || {}) as { formTypes?: FormType[] };
  const dateOfInstruction = basic.dateOfInstruction?.trim() || null;
  const ageDays = calcAgeDays(dateOfInstruction, asOf);
  const open = status !== 'approved';

  return {
    date_of_instruction: dateOfInstruction,
    client_insurer: basic.clientInsurer?.trim() || null,
    form_types: Array.isArray(header.formTypes) ? header.formTypes : [],
    age_days: ageDays,
    age_band: ageBandFromDays(ageDays),
    is_overdue: open && ageDays !== null && ageDays > SLA_DAYS,
  };
}

export function toListItem(row: DbDatasheetListRow): DatasheetListItem {
  const tracking = extractTrackingFields(row.form_data, row.status);
  const { form_data: _fd, ...rest } = row;
  return { ...rest, ...tracking };
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

export function buildAnalyticsSummary(rows: DatasheetListItem[]): AnalyticsSummary {
  const byStatusMap = new Map<DatasheetStatus, number>();
  const byAgeMap = new Map<AgeBand, number>();
  const byAssessorMap = new Map<
    string,
    { total: number; open: number; overdue: number; ages: number[] }
  >();
  const byInsurerMap = new Map<string, number>();
  const byFormTypeMap = new Map<string, number>();
  const volumeMap = new Map<string, { created: number; approved: number }>();

  AGE_BANDS.forEach((b) => byAgeMap.set(b, 0));

  let open = 0;
  let overdue = 0;
  let approvedInPeriod = 0;
  const openAges: number[] = [];

  for (const row of rows) {
    byStatusMap.set(row.status, (byStatusMap.get(row.status) || 0) + 1);
    byAgeMap.set(row.age_band, (byAgeMap.get(row.age_band) || 0) + 1);

    const assessor = row.assigned_to_name || row.created_by_name || 'Unassigned';
    const a = byAssessorMap.get(assessor) || { total: 0, open: 0, overdue: 0, ages: [] };
    a.total += 1;
    if (row.status !== 'approved') {
      a.open += 1;
      open += 1;
      if (row.age_days !== null) openAges.push(row.age_days);
      a.ages.push(...(row.age_days !== null ? [row.age_days] : []));
    } else {
      approvedInPeriod += 1;
    }
    if (row.is_overdue) {
      a.overdue += 1;
      overdue += 1;
    }
    byAssessorMap.set(assessor, a);

    const insurer = row.client_insurer || 'Unknown';
    byInsurerMap.set(insurer, (byInsurerMap.get(insurer) || 0) + 1);

    const types = row.form_types.length ? row.form_types : ['Unknown'];
    types.forEach((t) => byFormTypeMap.set(t, (byFormTypeMap.get(t) || 0) + 1));

    const month = row.created_at.slice(0, 7);
    const vol = volumeMap.get(month) || { created: 0, approved: 0 };
    vol.created += 1;
    if (row.status === 'approved') vol.approved += 1;
    volumeMap.set(month, vol);
  }

  const agingQueue = rows
    .filter((r) => r.status !== 'approved')
    .sort((a, b) => (b.age_days ?? -1) - (a.age_days ?? -1))
    .slice(0, 25)
    .map((r) => ({
      id: r.id,
      serial_no: r.serial_no,
      claim_no: r.claim_no,
      reg_no: r.reg_no,
      status: r.status,
      client_insurer: r.client_insurer,
      assigned_to_name: r.assigned_to_name || null,
      date_of_instruction: r.date_of_instruction,
      age_days: r.age_days,
      age_band: r.age_band,
    }));

  return {
    kpis: {
      total: rows.length,
      open,
      overdue,
      avgAgeDays: avg(openAges),
      approvedInPeriod,
    },
    byStatus: (['draft', 'submitted', 'under_review', 'approved'] as DatasheetStatus[]).map(
      (status) => ({ status, count: byStatusMap.get(status) || 0 }),
    ),
    byAgeBand: AGE_BANDS.map((band) => ({
      band,
      label: AGE_BAND_LABELS[band],
      count: byAgeMap.get(band) || 0,
    })),
    byAssessor: [...byAssessorMap.entries()]
      .map(([name, v]) => ({
        name,
        total: v.total,
        open: v.open,
        overdue: v.overdue,
        avgAgeDays: avg(v.ages),
      }))
      .sort((a, b) => b.open - a.open || b.total - a.total),
    byInsurer: [...byInsurerMap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
    byFormType: [...byFormTypeMap.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    volumeByMonth: [...volumeMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, v]) => ({ month, ...v })),
    agingQueue,
  };
}
