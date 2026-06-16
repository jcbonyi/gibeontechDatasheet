import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { handleRouteError } from '@/lib/routeErrors';
import { createDefaultFormData } from '@/types/datasheet';

function extractSearchFields(formData: Record<string, unknown>) {
  const basic = (formData.basicInfo || {}) as Record<string, string>;
  return {
    claimNo: basic.claimNo || null,
    regNo: basic.regNo || null,
  };
}

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const claimNo = searchParams.get('claimNo');
    const regNo = searchParams.get('regNo');

    const params: unknown[] = [];
    const conditions: string[] = [];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (claimNo) {
      params.push(`%${claimNo}%`);
      conditions.push(`claim_no ILIKE $${params.length}`);
    }
    if (regNo) {
      params.push(`%${regNo}%`);
      conditions.push(`reg_no ILIKE $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(
      `SELECT id, serial_no, status, claim_no, reg_no, created_at, updated_at
       FROM datasheets ${where}
       ORDER BY updated_at DESC`,
      params,
    );

    return NextResponse.json({ datasheets: result.rows });
  } catch (err) {
    return handleRouteError(err, 'GET /api/datasheets');
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const formData = body.formData || createDefaultFormData();
    const status = body.status === 'submitted' ? 'submitted' : 'draft';
    const { claimNo, regNo } = extractSearchFields(formData);
    const serialNo = await nextSerialNo();

    const result = await query(
      `INSERT INTO datasheets (serial_no, status, form_data, claim_no, reg_no)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [serialNo, status, formData, claimNo, regNo],
    );

    return NextResponse.json({ datasheet: result.rows[0] }, { status: 201 });
  } catch (err) {
    return handleRouteError(err, 'POST /api/datasheets');
  }
}
