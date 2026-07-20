import { NextRequest, NextResponse } from 'next/server';
import { getDatasheetById, logDatasheetAudit, updateDatasheetRecord } from '@/lib/db';
import { canViewDatasheet } from '@/lib/auth';
import { forbidden, badRequest, getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { canTransitionStatus } from '@/lib/permissions';
import { DATASHEET_STATUSES, normalizeStatus, STATUS_LABELS } from '@/lib/status';
import type { DatasheetStatus } from '@/types/datasheet';

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

    const updated = await updateDatasheetRecord(Number(id), {
      status: target,
      updated_by: user.id,
    });

    await logDatasheetAudit(datasheet.id, user.id, user.name, 'status_changed', {
      from: datasheet.status,
      to: target,
      label: STATUS_LABELS[target],
    });

    return NextResponse.json({ datasheet: updated });
  } catch (err) {
    return handleRouteError(err, 'PATCH /api/datasheets/[id]/review');
  }
}
