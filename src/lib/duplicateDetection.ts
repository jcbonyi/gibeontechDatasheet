import { isOpenStatus, normalizeStatus, STATUS_LABELS } from '@/lib/status';
import { normalizeNameKey } from '@/lib/nameNormalize';
import { normalizeRegNoKey } from '@/lib/syncDatasheetFromProduction';
import type { DatasheetStatus } from '@/types/datasheet';

export type DuplicateMatchKind = 'claim_insurer' | 'reg_claim' | 'reg_insurer';

export interface DuplicateCandidate {
  id: number;
  serial_no: string;
  status: DatasheetStatus;
  claim_no: string | null;
  reg_no: string | null;
  client_insurer: string | null;
  form_types?: string[] | string | null;
  assigned_to_name?: string | null;
  created_at: string;
  updated_at: string;
  date_of_instruction?: string | null;
  age_days?: number | null;
}

export interface DuplicateGroup {
  key: string;
  matchKind: DuplicateMatchKind;
  matchLabel: string;
  matchSummary: string;
  recommendedKeepId: number;
  items: DuplicateCandidate[];
}

/** Placeholder claim values that should not drive matching alone. */
const WEAK_CLAIM_RE =
  /^(t\.?\s*b\.?\s*a\.?|tba|n\/?a|nil|none|null|undefined|-|—|\.|pending|awaited|to\s*follow)$/i;

const PIPELINE_RANK: DatasheetStatus[] = [
  'instructed',
  'allocated',
  'in_progress',
  'awaiting_documents',
  'submitted',
  'pending_review',
  'under_review',
  'approved',
  'queried',
  'on_hold',
  'report_issued',
  'closed',
  'cancelled',
];

export function normalizeClaimKey(raw: string | null | undefined): string {
  const s = (raw || '')
    .replace(/\u00a0/g, ' ')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
  if (!s || WEAK_CLAIM_RE.test(s)) return '';
  return s;
}

export function normalizeInsurerKey(raw: string | null | undefined): string {
  return normalizeNameKey(raw);
}

export function isMeaningfulClaim(raw: string | null | undefined): boolean {
  return Boolean(normalizeClaimKey(raw));
}

export function isMeaningfulReg(raw: string | null | undefined): boolean {
  return Boolean(normalizeRegNoKey(raw));
}

function pipelineRank(status: string): number {
  const idx = PIPELINE_RANK.indexOf(normalizeStatus(status));
  return idx >= 0 ? idx : 0;
}

/** Prefer furthest along the pipeline; ties → oldest instruction (first file wins). */
export function pickRecommendedKeep(items: DuplicateCandidate[]): number {
  const sorted = [...items].sort((a, b) => {
    const rankDiff = pipelineRank(b.status) - pipelineRank(a.status);
    if (rankDiff !== 0) return rankDiff;
    const aTime = new Date(a.date_of_instruction || a.created_at).getTime();
    const bTime = new Date(b.date_of_instruction || b.created_at).getTime();
    if (aTime !== bTime) return aTime - bTime;
    return a.id - b.id;
  });
  return sorted[0]?.id ?? items[0].id;
}

const MATCH_LABELS: Record<DuplicateMatchKind, string> = {
  claim_insurer: 'Same claim + insurer',
  reg_claim: 'Same registration + claim',
  reg_insurer: 'Same registration + insurer (weak claim)',
};

function buildMatchSummary(
  kind: DuplicateMatchKind,
  sample: DuplicateCandidate,
): string {
  const claim = sample.claim_no?.trim() || '—';
  const reg = sample.reg_no?.trim() || '—';
  const insurer = sample.client_insurer?.trim() || '—';
  if (kind === 'claim_insurer') return `${claim} · ${insurer}`;
  if (kind === 'reg_claim') return `${reg} · ${claim}`;
  return `${reg} · ${insurer}`;
}

/**
 * Group open (non-cancelled) datasheets that look like duplicate instructions.
 * A row appears in at most one group (strongest match wins).
 */
export function findDuplicateGroups(rows: DuplicateCandidate[]): DuplicateGroup[] {
  const open = rows.filter((r) => {
    const s = normalizeStatus(r.status);
    return s !== 'cancelled' && isOpenStatus(s);
  });

  type Bucket = { kind: DuplicateMatchKind; key: string; items: DuplicateCandidate[] };
  const buckets = new Map<string, Bucket>();

  const add = (kind: DuplicateMatchKind, keyPart: string, row: DuplicateCandidate) => {
    if (!keyPart) return;
    const key = `${kind}:${keyPart}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.items.push(row);
      return;
    }
    buckets.set(key, { kind, key, items: [row] });
  };

  // Pass 1 — claim + insurer (strong)
  for (const row of open) {
    const claim = normalizeClaimKey(row.claim_no);
    const insurer = normalizeInsurerKey(row.client_insurer);
    if (claim && insurer) add('claim_insurer', `${claim}|${insurer}`, row);
  }

  // Pass 2 — reg + claim
  for (const row of open) {
    const claim = normalizeClaimKey(row.claim_no);
    const reg = normalizeRegNoKey(row.reg_no);
    if (claim && reg) add('reg_claim', `${reg}|${claim}`, row);
  }

  // Pass 3 — reg + insurer when claim is weak/missing
  for (const row of open) {
    if (normalizeClaimKey(row.claim_no)) continue;
    const reg = normalizeRegNoKey(row.reg_no);
    const insurer = normalizeInsurerKey(row.client_insurer);
    if (reg && insurer) add('reg_insurer', `${reg}|${insurer}`, row);
  }

  const claimed = new Set<number>();
  const groups: DuplicateGroup[] = [];

  const rankedBuckets = [...buckets.values()]
    .filter((b) => b.items.length >= 2)
    .sort((a, b) => {
      const kindOrder = { claim_insurer: 0, reg_claim: 1, reg_insurer: 2 };
      const kd = kindOrder[a.kind] - kindOrder[b.kind];
      if (kd !== 0) return kd;
      return b.items.length - a.items.length;
    });

  for (const bucket of rankedBuckets) {
    // Deduplicate items inside bucket (same row can be added once)
    const unique = new Map<number, DuplicateCandidate>();
    for (const item of bucket.items) unique.set(item.id, item);
    const items = [...unique.values()].filter((i) => !claimed.has(i.id));
    if (items.length < 2) continue;
    for (const item of items) claimed.add(item.id);
    groups.push({
      key: bucket.key,
      matchKind: bucket.kind,
      matchLabel: MATCH_LABELS[bucket.kind],
      matchSummary: buildMatchSummary(bucket.kind, items[0]),
      recommendedKeepId: pickRecommendedKeep(items),
      items: items.sort(
        (a, b) =>
          new Date(a.date_of_instruction || a.created_at).getTime() -
          new Date(b.date_of_instruction || b.created_at).getTime(),
      ),
    });
  }

  return groups.sort((a, b) => b.items.length - a.items.length);
}

/** Find open duplicates that collide with a prospective new/edited task. */
export function findConflictsForFields(
  rows: DuplicateCandidate[],
  fields: {
    claim_no?: string | null;
    reg_no?: string | null;
    client_insurer?: string | null;
    excludeId?: number;
  },
): DuplicateCandidate[] {
  const claim = normalizeClaimKey(fields.claim_no);
  const reg = normalizeRegNoKey(fields.reg_no);
  const insurer = normalizeInsurerKey(fields.client_insurer);
  if (!claim && !reg) return [];

  return rows.filter((row) => {
    if (fields.excludeId && row.id === fields.excludeId) return false;
    const s = normalizeStatus(row.status);
    if (s === 'cancelled' || !isOpenStatus(s)) return false;

    const rowClaim = normalizeClaimKey(row.claim_no);
    const rowReg = normalizeRegNoKey(row.reg_no);
    const rowInsurer = normalizeInsurerKey(row.client_insurer);

    if (claim && insurer && rowClaim === claim && rowInsurer === insurer) return true;
    if (claim && reg && rowClaim === claim && rowReg === reg) return true;
    if (!claim && reg && insurer && !rowClaim && rowReg === reg && rowInsurer === insurer) {
      return true;
    }
    return false;
  });
}

export function statusLabelForDuplicate(status: string): string {
  return STATUS_LABELS[normalizeStatus(status)] || status;
}
