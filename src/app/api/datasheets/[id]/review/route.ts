import { NextRequest, NextResponse } from 'next/server';
import { getDatasheetById, logDatasheetAudit, updateDatasheetRecord } from '@/lib/db';
import { canViewDatasheet } from '@/lib/auth';
import { forbidden, badRequest, getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { canIssueReport, canTransitionStatus } from '@/lib/permissions';
import { DATASHEET_STATUSES, normalizeStatus, STATUS_LABELS } from '@/lib/status';
import type { DatasheetStatus } from '@/types/datasheet';
import { CANCEL_REASONS } from '@/lib/opsConfig';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const datasheet = await getDatasheetById(Number(id));
    if (!datasheet) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }
    if (!canViewDatasheet(user, datasheet)) return forbidden();

    const body = await req.json();
    let nextStatus = String(body.status || body.action || '');
    if (nextStatus === 'approve') nextStatus = 'report_issued';

    if (!(DATASHEET_STATUSES as string[]).includes(nextStatus)) {
      return badRequest('Invalid status transition');
    }

    const target = normalizeStatus(nextStatus as DatasheetStatus);
    if (!canTransitionStatus(user, datasheet, target)) {
      return forbidden();
    }

    const reason = String(body.reason || '').trim();
    const cancelReason = String(body.cancelReason || '').trim();

    if (target === 'queried' && reason.length < 3) {
      return badRequest('A query reason is required (at least 3 characters)');
    }
    if (target === 'cancelled') {
      if (!CANCEL_REASONS.some((r) => r.value === cancelReason)) {
        return badRequest('Select a valid cancellation reason');
      }
      if (cancelReason === 'other' && reason.length < 3) {
        return badRequest('Please describe the cancellation reason');
      }
    }

    const patch: Parameters<typeof updateDatasheetRecord>[1] = {
      status: target,
      updated_by: user.id,
    };

    if (target === 'queried') {
      patch.query_reason = reason;
    }
    if (target === 'cancelled') {
      patch.cancel_reason = cancelReason;
      patch.query_reason = reason || cancelReason;
    }
    if (target === 'under_review' || target === 'report_issued') {
      if (canIssueReport(user) || user.role === 'OperationsManager') {
        patch.reviewed_by = user.id;
        patch.reviewed_at = new Date().toISOString();
      }
    }
    if (target === 'report_issued' && !canIssueReport(user)) {
      return forbidden();
    }

    const updated = await updateDatasheetRecord(Number(id), patch);

    await logDatasheetAudit(datasheet.id, user.id, user.name, 'status_changed', {
      from: datasheet.status,
      to: target,
      label: STATUS_LABELS[target],
      reason: reason || undefined,
      cancelReason: cancelReason || undefined,
    });

    return NextResponse.json({ datasheet: updated });
  } catch (err) {
    return handleRouteError(err, 'PATCH /api/datasheets/[id]/review');
  }
}
