import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { canEditDatasheet, canViewDatasheet, requireRole } from '@/lib/auth';
import {
  forbidden,
  getAuthUser,
  unauthorized,
} from '@/lib/api';

function extractSearchFields(formData: Record<string, unknown>) {
  const basic = (formData.basicInfo || {}) as Record<string, string>;
  return {
    claimNo: basic.claimNo || null,
    regNo: basic.regNo || null,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const result = await query('SELECT * FROM datasheets WHERE id = $1', [Number(id)]);
  const datasheet = result.rows[0];
  if (!datasheet) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }
  if (!canViewDatasheet(user, datasheet.created_by)) return forbidden();

  const attachments = await query(
    'SELECT * FROM datasheet_attachments WHERE datasheet_id = $1',
    [Number(id)],
  );

  return NextResponse.json({ datasheet, attachments: attachments.rows });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { id } = await params;
  const existing = await query('SELECT * FROM datasheets WHERE id = $1', [Number(id)]);
  const datasheet = existing.rows[0];
  if (!datasheet) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }
  if (!canEditDatasheet(user, datasheet.created_by)) return forbidden();

  const body = await req.json();
  const formData = body.formData ?? datasheet.form_data;
  const status = body.status ?? datasheet.status;
  const { claimNo, regNo } = extractSearchFields(formData);

  const result = await query(
    `UPDATE datasheets SET status = $1, updated_by = $2, form_data = $3, claim_no = $4, reg_no = $5
     WHERE id = $6 RETURNING *`,
    [status, user.id, formData, claimNo, regNo, Number(id)],
  );

  return NextResponse.json({ datasheet: result.rows[0] });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (!requireRole(user, ['Admin'])) return forbidden();

  const { id } = await params;
  await query('DELETE FROM datasheets WHERE id = $1', [Number(id)]);
  return NextResponse.json({ ok: true });
}
