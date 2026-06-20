import { NextRequest, NextResponse } from 'next/server';
import {
  getDatasheetById,
  insertDatasheetRecord,
  logDatasheetAudit,
  query,
} from '@/lib/db';
import { applySeenBy, canViewDatasheet } from '@/lib/auth';
import { forbidden, getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';

async function nextSerialNo(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DS-${year}-`;
  const result = await query<{ serial_no: string }>(
    `SELECT serial_no FROM datasheets WHERE serial_no LIKE $1 ORDER BY id DESC LIMIT 1`,
    [`${prefix}%`],
  );
  const last = result.rows[0]?.serial_no;
  const next = last ? Number(last.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

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
    );
    const serialNo = await nextSerialNo();

    const datasheet = await insertDatasheetRecord({
      serial_no: serialNo,
      status: 'draft',
      created_by: user.id,
      updated_by: user.id,
      form_data: formData,
      claim_no: source.claim_no,
      reg_no: source.reg_no,
      assigned_to: null,
      assigned_by: null,
      assigned_at: null,
      reopen_reason: null,
    });

    await logDatasheetAudit(datasheet.id, user.id, user.name, 'duplicated', {
      sourceId: source.id,
      sourceSerial: source.serial_no,
    });

    return NextResponse.json({ datasheet }, { status: 201 });
  } catch (err) {
    return handleRouteError(err, 'POST /api/datasheets/[id]/duplicate');
  }
}
