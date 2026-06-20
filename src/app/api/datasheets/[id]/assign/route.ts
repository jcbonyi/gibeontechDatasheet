import { NextRequest, NextResponse } from 'next/server';
import {
  getActiveUsers,
  getDatasheetById,
  logDatasheetAudit,
  updateDatasheetRecord,
} from '@/lib/db';
import { forbidden, badRequest, getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { canAssignDatasheet, canViewDatasheet } from '@/lib/permissions';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (!canAssignDatasheet(user)) return forbidden();

    const { id } = await params;
    const datasheet = await getDatasheetById(Number(id));
    if (!datasheet) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }
    if (!canViewDatasheet(user, datasheet)) return forbidden();

    const body = await req.json();
    const assignedTo = Number(body.assignedTo);
    if (!assignedTo) return badRequest('assignedTo is required');

    const assessors = await getActiveUsers('Assessor');
    const target = assessors.find((a) => a.id === assignedTo);
    if (!target) return badRequest('Assignee must be an active Assessor');

    const updated = await updateDatasheetRecord(Number(id), {
      assigned_to: assignedTo,
      assigned_by: user.id,
      assigned_at: new Date().toISOString(),
      updated_by: user.id,
    });

    await logDatasheetAudit(datasheet.id, user.id, user.name, 'assigned', {
      assignedTo: target.name,
      assignedToId: assignedTo,
    });

    return NextResponse.json({ datasheet: updated });
  } catch (err) {
    return handleRouteError(err, 'POST /api/datasheets/[id]/assign');
  }
}
