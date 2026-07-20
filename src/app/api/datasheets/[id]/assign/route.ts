import { NextRequest, NextResponse } from 'next/server';
import {
  getAssignableUsers,
  getDatasheetById,
  logDatasheetAudit,
  updateDatasheetRecord,
} from '@/lib/db';
import { forbidden, badRequest, getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { canAssignDatasheet, canViewDatasheet, isSuperUser } from '@/lib/permissions';
import { isOpenStatus, normalizeStatus } from '@/lib/status';

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

    const status = normalizeStatus(datasheet.status);
    if (!isSuperUser(user.role) && !isOpenStatus(status)) {
      return badRequest('Only open tasks can be allocated');
    }

    const body = await req.json();
    const assignedTo = Number(body.assignedTo);
    if (!assignedTo) return badRequest('assignedTo is required');

    const assignable = await getAssignableUsers();
    const target = assignable.find((a) => a.id === assignedTo);
    if (!target) {
      return badRequest('Assignee must be an active Assessor or Principal Officer');
    }

    const updated = await updateDatasheetRecord(Number(id), {
      assigned_to: assignedTo,
      assigned_by: user.id,
      assigned_at: new Date().toISOString(),
      updated_by: user.id,
      ...(status === 'instructed' ? { status: 'allocated' as const } : {}),
    });

    await logDatasheetAudit(datasheet.id, user.id, user.name, 'assigned', {
      assignedTo: target.name,
      assignedToId: assignedTo,
      assignedRole: target.role,
      status: status === 'instructed' ? 'allocated' : status,
    });

    return NextResponse.json({ datasheet: updated });
  } catch (err) {
    return handleRouteError(err, 'POST /api/datasheets/[id]/assign');
  }
}
