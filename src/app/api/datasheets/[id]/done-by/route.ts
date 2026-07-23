import { NextRequest, NextResponse } from 'next/server';
import {
  getAssignableUsers,
  getDatasheetById,
  logDatasheetAudit,
  updateDatasheetRecord,
} from '@/lib/db';
import { forbidden, badRequest, getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { canSetDoneBy, canViewDatasheet } from '@/lib/permissions';

export async function POST(
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

    const form = datasheet.form_data as { signOff?: { seenBy?: string } } | null;
    let seenByName = form?.signOff?.seenBy || null;
    if (!canSetDoneBy(user, { ...datasheet, seenByName })) return forbidden();

    const body = await req.json();
    const doneBy = Number(body.doneBy);
    if (!doneBy) return badRequest('doneBy is required');

    const assignable = await getAssignableUsers();
    const target = assignable.find((a) => a.id === doneBy);
    if (!target) {
      return badRequest('Done By must be an active Assessor or Principal Officer');
    }

    const patch: { done_by: number; updated_by: number; form_data?: Record<string, unknown> } = {
      done_by: doneBy,
      updated_by: user.id,
    };

    // Stamp Seen By when an Assessor sets Done By and Seen By is still empty
    if (user.role === 'Assessor' && !String(seenByName || '').trim()) {
      const formData = {
        ...(datasheet.form_data as Record<string, unknown>),
        signOff: {
          ...((datasheet.form_data as { signOff?: Record<string, unknown> })?.signOff || {}),
          seenBy: user.name,
        },
      };
      patch.form_data = formData;
      seenByName = user.name;
    }

    const updated = await updateDatasheetRecord(Number(id), patch);

    await logDatasheetAudit(datasheet.id, user.id, user.name, 'done_by_set', {
      doneBy: target.name,
      doneById: doneBy,
      doneByRole: target.role,
      seenBy: seenByName,
    });

    return NextResponse.json({ datasheet: updated });
  } catch (err) {
    return handleRouteError(err, 'POST /api/datasheets/[id]/done-by');
  }
}
