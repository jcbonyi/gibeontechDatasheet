import { NextRequest, NextResponse } from 'next/server';
import { getDatasheetById, logDatasheetAudit, updateDatasheetRecord } from '@/lib/db';
import { badRequest, forbidden, getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { canOverrideAnyStatus, canReviewDatasheet } from '@/lib/permissions';
import { isOpenStatus, normalizeStatus, STATUS_LABELS } from '@/lib/status';
import type { DatasheetStatus } from '@/types/datasheet';

/**
 * POST /api/datasheets/duplicates/resolve
 * Keep one task and cancel the rest as duplicate_file.
 *
 * Body: { keepId: number, cancelIds: number[], note?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (!canReviewDatasheet(user) && !canOverrideAnyStatus(user)) {
      return forbidden();
    }

    const body = await req.json();
    const keepId = Number(body.keepId);
    const cancelIds: number[] = [];
    if (Array.isArray(body.cancelIds)) {
      for (const raw of body.cancelIds) {
        const n = Number(raw);
        if (Number.isFinite(n) && n > 0 && !cancelIds.includes(n)) cancelIds.push(n);
      }
    }
    const note = String(body.note || '').trim();

    if (!Number.isFinite(keepId) || keepId <= 0) {
      return badRequest('keepId is required');
    }
    if (!cancelIds.length) {
      return badRequest('Select at least one duplicate to cancel');
    }
    if (cancelIds.includes(keepId)) {
      return badRequest('Cannot cancel the task you chose to keep');
    }

    const keep = await getDatasheetById(keepId);
    if (!keep) return badRequest('Keep task not found');

    const cancelled: { id: number; serial_no: string }[] = [];
    const skipped: { id: number; serial_no?: string; reason: string }[] = [];

    for (const id of cancelIds) {
      const row = await getDatasheetById(id);
      if (!row) {
        skipped.push({ id, reason: 'Not found' });
        continue;
      }
      const status = normalizeStatus(row.status);
      if (status === 'cancelled') {
        skipped.push({ id, serial_no: row.serial_no, reason: 'Already cancelled' });
        continue;
      }
      if (!isOpenStatus(status)) {
        skipped.push({
          id,
          serial_no: row.serial_no,
          reason: `Only open tasks can be cancelled here (${STATUS_LABELS[status]})`,
        });
        continue;
      }

      await updateDatasheetRecord(id, {
        status: 'cancelled' as DatasheetStatus,
        cancel_reason: 'duplicate_file',
        query_reason: note || `Duplicate of ${keep.serial_no}`,
        updated_by: user.id,
      });

      await logDatasheetAudit(id, user.id, user.name, 'status_changed', {
        from: row.status,
        to: 'cancelled',
        label: STATUS_LABELS.cancelled,
        cancelReason: 'duplicate_file',
        reason: note || `Duplicate of ${keep.serial_no}`,
        duplicateOfId: keepId,
        duplicateOfSerial: keep.serial_no,
      });

      cancelled.push({ id, serial_no: row.serial_no });
    }

    await logDatasheetAudit(keepId, user.id, user.name, 'duplicate_resolved', {
      kept: keep.serial_no,
      cancelledIds: cancelled.map((c) => c.id),
      cancelledSerials: cancelled.map((c) => c.serial_no),
      note: note || undefined,
    });

    return NextResponse.json({
      keep: { id: keep.id, serial_no: keep.serial_no },
      cancelled,
      skipped,
      message:
        cancelled.length > 0
          ? `Kept ${keep.serial_no}; cancelled ${cancelled.length} duplicate${cancelled.length === 1 ? '' : 's'}`
          : 'No duplicates were cancelled',
    });
  } catch (err) {
    return handleRouteError(err, 'POST /api/datasheets/duplicates/resolve');
  }
}
