import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { handleRouteError } from '@/lib/routeErrors';

function extractSearchFields(formData: Record<string, unknown>) {
  const basic = (formData.basicInfo || {}) as Record<string, string>;
  return {
    claimNo: basic.claimNo || null,
    regNo: basic.regNo || null,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await query('SELECT * FROM datasheets WHERE id = $1', [Number(id)]);
    const datasheet = result.rows[0];
    if (!datasheet) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ datasheet });
  } catch (err) {
    return handleRouteError(err, 'GET /api/datasheets/[id]');
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const existing = await query('SELECT * FROM datasheets WHERE id = $1', [Number(id)]);
    const datasheet = existing.rows[0];
    if (!datasheet) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    const body = await req.json();
    const formData = body.formData ?? datasheet.form_data;
    const status = body.status ?? datasheet.status;
    const { claimNo, regNo } = extractSearchFields(formData);

    const result = await query(
      `UPDATE datasheets SET status = $1, form_data = $2, claim_no = $3, reg_no = $4, updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [status, formData, claimNo, regNo, Number(id)],
    );

    return NextResponse.json({ datasheet: result.rows[0] });
  } catch (err) {
    return handleRouteError(err, 'PATCH /api/datasheets/[id]');
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await query('DELETE FROM datasheets WHERE id = $1', [Number(id)]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err, 'DELETE /api/datasheets/[id]');
  }
}
