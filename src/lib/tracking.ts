import type { DatasheetStatus, FormType } from '@/types/datasheet';
import { DATASHEET_STATUSES, isOpenStatus, normalizeStatus } from '@/lib/status';
import type { DbAuditEntry, DbDatasheetListRow } from '@/lib/db';

export type AgeBand = '0-3' | '4-7' | '8-14' | '15+' | 'unknown';

export const AGE_BANDS: AgeBand[] = ['0-3', '4-7', '8-14', '15+', 'unknown'];

export const AGE_BAND_LABELS: Record<AgeBand, string> = {
  '0-3': '0–3 days',
  '4-7': '4–7 days',
  '8-14': '8–14 days',
  '15+': '15+ days',
  unknown: 'No instruction date',
};

export const SLA_DAYS = 2;

/** Days from instruction when open work should be chased before SLA breach. */
export const AT_RISK_FROM_DAY = 1;

export interface TrackingFields {
  date_of_instruction: string | null;
  client_insurer: string | null;
  form_types: FormType[];
  age_days: number | null;
  age_band: AgeBand;
  is_overdue: boolean;
}

export interface DatasheetListItem
  extends Omit<
      DbDatasheetListRow,
      'form_data' | 'form_types' | 'client_insurer' | 'date_of_instruction'
    >,
    TrackingFields {}

export interface CycleTimeMetrics {
  avgInstructedToIssuedDays: number | null;
  avgInProgressDays: number | null;
  avgUnderReviewDays: number | null;
  sampleSizeIssued: number;
}

export type QueuePriority = 'critical' | 'overdue' | 'at_risk' | 'unassigned' | 'review' | 'normal';

export interface AnalyticsSummary {
  kpis: {
    total: number;
    open: number;
    overdue: number;
    avgAgeDays: number | null;
    approvedInPeriod: number;
    slaCompliancePct: number | null;
    withinSla: number;
  };
  /** Counts that drive day-to-day management decisions */
  decisions: {
    unassigned: number;
    atRisk: number;
    overdueCritical: number;
    pendingReview: number;
    underReview: number;
    awaitingDocuments: number;
    queried: number;
    onHold: number;
    attentionTotal: number;
  };
  cycleTime: CycleTimeMetrics;
  byStatus: { status: DatasheetStatus; count: number }[];
  byAgeBand: { band: AgeBand; label: string; count: number }[];
  byAssessor: {
    name: string;
    total: number;
    open: number;
    overdue: number;
    avgAgeDays: number | null;
    slaPct: number | null;
  }[];
  byInsurer: { name: string; count: number; overdue: number; slaPct: number | null }[];
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
    is_overdue: boolean;
    priority: QueuePriority;
  }[];
}

export function queuePriorityFor(row: {
  status: DatasheetStatus;
  age_days: number | null;
  is_overdue: boolean;
  assigned_to_name?: string | null;
}): QueuePriority {
  const unassigned = !row.assigned_to_name;
  if (row.is_overdue && (row.age_days ?? 0) >= 15) return 'critical';
  if (row.is_overdue) return 'overdue';
  if (unassigned && isOpenStatus(row.status)) return 'unassigned';
  if (
    row.age_days != null &&
    row.age_days >= AT_RISK_FROM_DAY &&
    row.age_days <= SLA_DAYS &&
    isOpenStatus(row.status)
  ) {
    return 'at_risk';
  }
  if (row.status === 'pending_review' || row.status === 'under_review' || row.status === 'queried') {
    return 'review';
  }
  return 'normal';
}

const PRIORITY_RANK: Record<QueuePriority, number> = {
  critical: 0,
  overdue: 1,
  unassigned: 2,
  at_risk: 3,
  review: 4,
  normal: 5,
};

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
  row?: Pick<DbDatasheetListRow, 'date_of_instruction' | 'client_insurer' | 'form_types'>,
  asOf = new Date(),
): TrackingFields {
  const basic = (formData?.basicInfo || {}) as Record<string, string>;
  const header = (formData?.header || {}) as { formTypes?: FormType[] };
  const dateOfInstruction =
    row?.date_of_instruction?.toString().slice(0, 10) ||
    basic.dateOfInstruction?.trim() ||
    null;
  const ageDays = calcAgeDays(dateOfInstruction, asOf);
  const open = isOpenStatus(status);
  const formTypesFromCol = row?.form_types
    ? (row.form_types.split(',').filter(Boolean) as FormType[])
    : [];

  return {
    date_of_instruction: dateOfInstruction,
    client_insurer: row?.client_insurer || basic.clientInsurer?.trim() || null,
    form_types: formTypesFromCol.length
      ? formTypesFromCol
      : Array.isArray(header.formTypes)
        ? header.formTypes
        : [],
    age_days: ageDays,
    age_band: ageBandFromDays(ageDays),
    is_overdue: open && ageDays !== null && ageDays > SLA_DAYS,
  };
}

export function toListItem(row: DbDatasheetListRow): DatasheetListItem {
  const status = normalizeStatus(row.status);
  const tracking = extractTrackingFields(row.form_data, status, row);
  const { form_data: _fd, ...rest } = row;
  return { ...rest, status, ...tracking };
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.max(0, Math.floor((db - da) / (1000 * 60 * 60 * 24)));
}

/** Derive cycle times from status_changed audit events. */
export function buildCycleTimeMetrics(
  rows: DatasheetListItem[],
  audits: DbAuditEntry[],
): CycleTimeMetrics {
  const byDs = new Map<number, DbAuditEntry[]>();
  audits.forEach((a) => {
    const list = byDs.get(a.datasheet_id) || [];
    list.push(a);
    byDs.set(a.datasheet_id, list);
  });

  const instructedToIssued: number[] = [];
  const inProgressDwells: number[] = [];
  const underReviewDwells: number[] = [];

  for (const row of rows) {
    const events = (byDs.get(row.id) || [])
      .filter((e) => e.action === 'status_changed' || e.action === 'created')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    let enteredInProgress: string | null = null;
    let enteredUnderReview: string | null = null;

    for (const e of events) {
      const to = String(e.details?.to || '');
      if (to === 'in_progress') enteredInProgress = e.created_at;
      if (to === 'under_review') enteredUnderReview = e.created_at;
      if (to === 'pending_review' && enteredInProgress) {
        inProgressDwells.push(daysBetween(enteredInProgress, e.created_at));
        enteredInProgress = null;
      }
      if ((to === 'report_issued' || to === 'queried') && enteredUnderReview) {
        underReviewDwells.push(daysBetween(enteredUnderReview, e.created_at));
        enteredUnderReview = null;
      }
      if (to === 'report_issued' && row.date_of_instruction) {
        instructedToIssued.push(daysBetween(`${row.date_of_instruction}T00:00:00`, e.created_at));
      }
    }

    if (
      (row.status === 'report_issued' || row.status === 'closed') &&
      row.date_of_instruction &&
      !instructedToIssued.length
    ) {
      instructedToIssued.push(daysBetween(`${row.date_of_instruction}T00:00:00`, row.updated_at));
    }
  }

  return {
    avgInstructedToIssuedDays: avg(instructedToIssued),
    avgInProgressDays: avg(inProgressDwells),
    avgUnderReviewDays: avg(underReviewDwells),
    sampleSizeIssued: instructedToIssued.length,
  };
}

export function buildAnalyticsSummary(
  rows: DatasheetListItem[],
  audits: DbAuditEntry[] = [],
): AnalyticsSummary {
  const byStatusMap = new Map<DatasheetStatus, number>();
  const byAgeMap = new Map<AgeBand, number>();
  const byAssessorMap = new Map<
    string,
    { total: number; open: number; overdue: number; ages: number[]; closedWithAge: number[]; withinSla: number }
  >();
  const byInsurerMap = new Map<
    string,
    { count: number; overdue: number; closedWithAge: number[]; withinSla: number }
  >();
  const byFormTypeMap = new Map<string, number>();
  const volumeMap = new Map<string, { created: number; approved: number }>();

  AGE_BANDS.forEach((b) => byAgeMap.set(b, 0));

  let open = 0;
  let overdue = 0;
  let approvedInPeriod = 0;
  let withinSla = 0;
  let slaDenom = 0;
  let unassigned = 0;
  let atRisk = 0;
  let overdueCritical = 0;
  const openAges: number[] = [];

  for (const row of rows) {
    byStatusMap.set(row.status, (byStatusMap.get(row.status) || 0) + 1);
    byAgeMap.set(row.age_band, (byAgeMap.get(row.age_band) || 0) + 1);

    const isUnassigned = !row.assigned_to_name;
    const assessor = row.assigned_to_name || row.created_by_name || 'Unassigned';
    const a = byAssessorMap.get(assessor) || {
      total: 0,
      open: 0,
      overdue: 0,
      ages: [],
      closedWithAge: [],
      withinSla: 0,
    };
    a.total += 1;

    if (isOpenStatus(row.status)) {
      a.open += 1;
      open += 1;
      if (isUnassigned) unassigned += 1;
      if (row.age_days !== null) openAges.push(row.age_days);
      if (row.age_days !== null) a.ages.push(row.age_days);
      if (
        row.age_days != null &&
        row.age_days >= AT_RISK_FROM_DAY &&
        row.age_days <= SLA_DAYS &&
        !row.is_overdue
      ) {
        atRisk += 1;
      }
      if (row.is_overdue && (row.age_days ?? 0) >= 15) overdueCritical += 1;
    } else if (row.status === 'report_issued' || row.status === 'closed') {
      approvedInPeriod += 1;
      if (row.age_days !== null) {
        slaDenom += 1;
        a.closedWithAge.push(row.age_days);
        if (row.age_days <= SLA_DAYS) {
          withinSla += 1;
          a.withinSla += 1;
        }
      }
    }
    if (row.is_overdue) {
      a.overdue += 1;
      overdue += 1;
    }
    byAssessorMap.set(assessor, a);

    const insurer = row.client_insurer || 'Unknown';
    const ins = byInsurerMap.get(insurer) || {
      count: 0,
      overdue: 0,
      closedWithAge: [],
      withinSla: 0,
    };
    ins.count += 1;
    if (row.is_overdue) ins.overdue += 1;
    if (
      (row.status === 'report_issued' || row.status === 'closed') &&
      row.age_days !== null
    ) {
      ins.closedWithAge.push(row.age_days);
      if (row.age_days <= SLA_DAYS) ins.withinSla += 1;
    }
    byInsurerMap.set(insurer, ins);

    const types = row.form_types.length ? row.form_types : ['Unknown'];
    types.forEach((t: string) => byFormTypeMap.set(t, (byFormTypeMap.get(t) || 0) + 1));

    const month = row.created_at.slice(0, 7);
    const vol = volumeMap.get(month) || { created: 0, approved: 0 };
    vol.created += 1;
    if (row.status === 'report_issued' || row.status === 'closed') vol.approved += 1;
    volumeMap.set(month, vol);
  }

  const pendingReview = byStatusMap.get('pending_review') || 0;
  const underReview = byStatusMap.get('under_review') || 0;
  const awaitingDocuments = byStatusMap.get('awaiting_documents') || 0;
  const queried = byStatusMap.get('queried') || 0;
  const onHold = byStatusMap.get('on_hold') || 0;

  const agingQueue = rows
    .filter((r) => isOpenStatus(r.status))
    .map((r) => {
      const assigned_to_name = r.assigned_to_name || null;
      const priority = queuePriorityFor({
        status: r.status,
        age_days: r.age_days,
        is_overdue: r.is_overdue,
        assigned_to_name,
      });
      return {
        id: r.id,
        serial_no: r.serial_no,
        claim_no: r.claim_no,
        reg_no: r.reg_no,
        status: r.status,
        client_insurer: r.client_insurer ?? null,
        assigned_to_name,
        date_of_instruction: r.date_of_instruction ?? null,
        age_days: r.age_days,
        age_band: r.age_band,
        is_overdue: r.is_overdue,
        priority,
      };
    })
    .sort(
      (a, b) =>
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        (b.age_days ?? -1) - (a.age_days ?? -1),
    )
    .slice(0, 40);

  const slaPct = slaDenom ? Math.round((withinSla / slaDenom) * 1000) / 10 : null;
  const attentionTotal =
    overdue + unassigned + atRisk + pendingReview + underReview + queried;

  return {
    kpis: {
      total: rows.length,
      open,
      overdue,
      avgAgeDays: avg(openAges),
      approvedInPeriod,
      slaCompliancePct: slaPct,
      withinSla,
    },
    decisions: {
      unassigned,
      atRisk,
      overdueCritical,
      pendingReview,
      underReview,
      awaitingDocuments,
      queried,
      onHold,
      attentionTotal,
    },
    cycleTime: buildCycleTimeMetrics(rows, audits),
    byStatus: DATASHEET_STATUSES.map((status) => ({
      status,
      count: byStatusMap.get(status) || 0,
    })),
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
        slaPct: v.closedWithAge.length
          ? Math.round((v.withinSla / v.closedWithAge.length) * 1000) / 10
          : null,
      }))
      .sort((a, b) => b.open - a.open || b.total - a.total),
    byInsurer: [...byInsurerMap.entries()]
      .map(([name, v]) => ({
        name,
        count: v.count,
        overdue: v.overdue,
        slaPct: v.closedWithAge.length
          ? Math.round((v.withinSla / v.closedWithAge.length) * 1000) / 10
          : null,
      }))
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
