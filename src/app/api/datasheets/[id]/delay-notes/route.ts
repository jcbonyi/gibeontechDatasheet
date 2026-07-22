import { NextRequest, NextResponse } from 'next/server';
import { getDatasheetById, logDatasheetAudit, updateDatasheetRecord } from '@/lib/db';
import { canViewDatasheet } from '@/lib/auth';
import { badRequest, forbidden, getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import {
  DELAY_REASONS,
  normalizeDelayNotes,
  type DelayNote,
  type DelayReasonCode,
} from '@/lib/opsConfig';
import { calcAgeDays, extractTrackingFields } from '@/lib/tracking';

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

    const body = await req.json();
    const note = String(body.note || '').trim();
    const reasonCode = String(body.reasonCode || 'other').trim() as DelayReasonCode | string;

    if (note.length < 3) {
      return badRequest('Delay note must be at least 3 characters');
    }
    if (note.length > 2000) {
      return badRequest('Delay note is too long (max 2000 characters)');
    }
    const validCodes = DELAY_REASONS.map((r) => r.value);
    if (!validCodes.includes(reasonCode as DelayReasonCode)) {
      return badRequest('Select a valid delay reason');
    }
    if (reasonCode === 'other' && note.length < 3) {
      return badRequest('Please describe the delay reason');
    }

    const tracking = extractTrackingFields(datasheet.form_data, datasheet.status, datasheet);
    const existing = normalizeDelayNotes(datasheet.delay_notes);
    const entry: DelayNote = {
      id: `dn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      note,
      reasonCode,
      createdBy: user.id,
      createdByName: user.name,
      createdAt: new Date().toISOString(),
      ageDaysAtNote: tracking.age_days ?? calcAgeDays(tracking.date_of_instruction),
    };
    const delay_notes = [...existing, entry];

    const updated = await updateDatasheetRecord(datasheet.id, {
      delay_notes,
      updated_by: user.id,
    });

    await logDatasheetAudit(datasheet.id, user.id, user.name, 'delay_note', {
      reasonCode,
      note,
      ageDaysAtNote: entry.ageDaysAtNote,
    });

    return NextResponse.json({
      delayNotes: normalizeDelayNotes(updated?.delay_notes ?? delay_notes),
      note: entry,
    });
  } catch (err) {
    return handleRouteError(err, 'POST /api/datasheets/[id]/delay-notes');
  }
}
