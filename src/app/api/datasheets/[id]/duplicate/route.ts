import { NextRequest, NextResponse } from 'next/server';
import {
  allocateNextSerialNo,
  getDatasheetById,
  insertDatasheetRecord,
  isDuplicateSerialError,
  logDatasheetAudit,
} from '@/lib/db';
import { applySeenBy, canViewDatasheet } from '@/lib/auth';
import { forbidden, getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const source = await getDatasheetById(Number(id));
    if (!source) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }
    if (!canViewDatasheet(user, source)) return forbidden();

    const formData = applySeenBy(
      JSON.parse(JSON.stringify(source.form_data)) as Record<string, unknown>,
      user.name,
      user.role,
    );

    let datasheet = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const serialNo = await allocateNextSerialNo();
      try {
        datasheet = await insertDatasheetRecord({
          serial_no: serialNo,
          status: 'instructed',
          created_by: user.id,
          updated_by: user.id,
          form_data: formData,
          claim_no: source.claim_no,
          reg_no: source.reg_no,
          assigned_to: null,
          assigned_by: null,
          assigned_at: null,
          reopen_reason: null,
          date_of_instruction: source.date_of_instruction ?? null,
          client_insurer: source.client_insurer ?? null,
          form_types: source.form_types ?? null,
          cancel_reason: null,
          query_reason: null,
          reviewed_by: null,
          reviewed_at: null,
          search_text: source.search_text ?? null,
          delay_notes: [],
        });
        break;
      } catch (err) {
        if (!isDuplicateSerialError(err) || attempt === 4) throw err;
      }
    }

    if (!datasheet) {
      throw new Error('Failed to allocate a unique serial number');
    }

    await logDatasheetAudit(datasheet.id, user.id, user.name, 'duplicated', {
      sourceId: source.id,
      sourceSerial: source.serial_no,
    });

    return NextResponse.json({ datasheet }, { status: 201 });
  } catch (err) {
    return handleRouteError(err, 'POST /api/datasheets/[id]/duplicate');
  }
}
