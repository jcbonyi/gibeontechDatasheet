import { NextRequest, NextResponse } from 'next/server';
import { getDatasheetById, logDatasheetAudit, updateDatasheetRecord } from '@/lib/db';
import { canViewDatasheet } from '@/lib/auth';
import { forbidden, badRequest, getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { canReopenDatasheet } from '@/lib/permissions';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (!canReopenDatasheet(user)) return forbidden();

    const { id } = await params;
    const datasheet = await getDatasheetById(Number(id));
    if (!datasheet) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }
    if (!canViewDatasheet(user, datasheet)) return forbidden();
    if (datasheet.status === 'draft') {
      return badRequest('Only submitted, under review, or approved datasheets can be reopened');
    }

    const body = await req.json();
    const reason = String(body.reason || '').trim();
    if (!reason) return badRequest('Reopen reason is required');

    const updated = await updateDatasheetRecord(Number(id), {
      status: 'draft',
      reopen_reason: reason,
      updated_by: user.id,
    });

    await logDatasheetAudit(datasheet.id, user.id, user.name, 'reopened', {
      reason,
      previousStatus: datasheet.status,
    });

    return NextResponse.json({ datasheet: updated });
  } catch (err) {
    return handleRouteError(err, 'POST /api/datasheets/[id]/reopen');
  }
}
