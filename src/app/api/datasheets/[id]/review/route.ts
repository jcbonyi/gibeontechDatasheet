import { NextRequest, NextResponse } from 'next/server';
import { getDatasheetById, logDatasheetAudit, updateDatasheetRecord } from '@/lib/db';
import { canViewDatasheet } from '@/lib/auth';
import { forbidden, badRequest, getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { canReviewDatasheet, canApproveDatasheet } from '@/lib/permissions';

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
    const action = String(body.action || '');

    if (action === 'under_review') {
      if (!canReviewDatasheet(user)) return forbidden();
      if (datasheet.status !== 'submitted') {
        return badRequest('Only submitted datasheets can be marked under review');
      }
      const updated = await updateDatasheetRecord(Number(id), {
        status: 'under_review',
        updated_by: user.id,
      });
      await logDatasheetAudit(datasheet.id, user.id, user.name, 'under_review', {});
      return NextResponse.json({ datasheet: updated });
    }

    if (action === 'approve') {
      if (!canApproveDatasheet(user)) return forbidden();
      if (datasheet.status !== 'submitted' && datasheet.status !== 'under_review') {
        return badRequest('Only submitted or under review datasheets can be approved');
      }
      const updated = await updateDatasheetRecord(Number(id), {
        status: 'approved',
        updated_by: user.id,
      });
      await logDatasheetAudit(datasheet.id, user.id, user.name, 'approved', {});
      return NextResponse.json({ datasheet: updated });
    }

    return badRequest('Invalid review action');
  } catch (err) {
    return handleRouteError(err, 'PATCH /api/datasheets/[id]/review');
  }
}
