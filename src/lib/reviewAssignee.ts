import {
  createUserRecord,
  ensureDb,
  getActiveUsers,
  isJsonMode,
  isSupabaseMode,
  query,
  updateDatasheetRecord,
} from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { DatasheetStatus } from '@/types/datasheet';
import crypto from 'crypto';

const REVIEW_STATUSES: DatasheetStatus[] = ['pending_review', 'under_review'];

export function isReviewStatus(status: string | null | undefined): boolean {
  const s = String(status || '');
  return REVIEW_STATUSES.includes(s as DatasheetStatus);
}

/** Find Francis (or create Assessor account if missing). */
export async function getFrancisUserId(): Promise<number | null> {
  await ensureDb();
  const users = await getActiveUsers();
  const needle = 'francis';
  const exact = users.find((u) => u.name.trim().toLowerCase() === needle);
  if (exact) return exact.id;
  const starts = users.find((u) => u.name.trim().toLowerCase().startsWith(`${needle} `));
  if (starts) return starts.id;
  const partial = users.filter(
    (u) =>
      u.name.trim().toLowerCase().includes(needle) ||
      needle.includes(u.name.trim().toLowerCase()),
  );
  if (partial.length === 1) return partial[0].id;

  const email = `francis.${Date.now()}.${crypto.randomBytes(2).toString('hex')}@gibeontech.local`;
  const password_hash = await hashPassword(crypto.randomBytes(24).toString('hex'));
  const created = await createUserRecord({
    name: 'Francis',
    email,
    password_hash,
    role: 'Assessor',
    is_active: true,
  });
  return created.id;
}

/** Assign a single datasheet to Francis when status is Pending/Under Review. */
export async function assignToFrancisIfReview(
  datasheetId: number,
  status: string,
  actorUserId: number | null,
): Promise<number | null> {
  if (!isReviewStatus(status)) return null;
  const francisId = await getFrancisUserId();
  if (!francisId) return null;
  await updateDatasheetRecord(datasheetId, {
    assigned_to: francisId,
    assigned_by: actorUserId,
    assigned_at: new Date().toISOString(),
    ...(actorUserId ? { updated_by: actorUserId } : {}),
  });
  return francisId;
}

/**
 * Backfill: every Pending Review / Under Review task is allocated to Francis.
 * Safe to call repeatedly — only updates rows not already assigned to Francis.
 */
export async function ensureReviewTasksAssignedToFrancis(): Promise<number> {
  const francisId = await getFrancisUserId();
  if (!francisId) return 0;
  await ensureDb();
  const now = new Date().toISOString();

  if (isJsonMode()) {
    // json mode uses module store via query shim — update through list+update
    const { listDatasheets } = await import('@/lib/db');
    const rows = await listDatasheets({ viewAll: true });
    let count = 0;
    for (const row of rows) {
      if (!isReviewStatus(row.status)) continue;
      if (row.assigned_to === francisId) continue;
      await updateDatasheetRecord(row.id, {
        assigned_to: francisId,
        assigned_at: row.assigned_at || now,
      });
      count += 1;
    }
    return count;
  }

  if (isSupabaseMode()) {
    const client = getSupabaseAdmin();
    if (!client) return 0;
    const { data, error } = await client
      .from('datasheets')
      .update({
        assigned_to: francisId,
        assigned_at: now,
      })
      .in('status', REVIEW_STATUSES)
      .or(`assigned_to.is.null,assigned_to.neq.${francisId}`)
      .select('id');
    if (error) throw new Error(error.message);
    return data?.length || 0;
  }

  const result = await query(
    `UPDATE datasheets
     SET assigned_to = $1,
         assigned_at = COALESCE(assigned_at, NOW()),
         assigned_by = COALESCE(assigned_by, $1)
     WHERE status IN ('pending_review', 'under_review')
       AND (assigned_to IS DISTINCT FROM $1)
     RETURNING id`,
    [francisId],
  );
  return result.rowCount || 0;
}
