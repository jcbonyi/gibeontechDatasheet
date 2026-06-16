import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  canEditDatasheet,
  canViewDatasheet,
  requireRole,
} from '@/lib/auth';
import {
  badRequest,
  forbidden,
  getAuthUser,
  unauthorized,
} from '@/lib/api';
import { createDefaultFormData } from '@/types/datasheet';

function extractSearchFields(formData: Record<string, unknown>) {
  const basic = (formData.basicInfo || {}) as Record<string, string>;
  return {
    claimNo: basic.claimNo || null,
    regNo: basic.regNo || null,
  };
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const claimNo = searchParams.get('claimNo');
  const regNo = searchParams.get('regNo');
  const assessorId = searchParams.get('assessorId');

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
  if (assessorId) {
    params.push(Number(assessorId));
    conditions.push(`created_by = $${params.length}`);
  } else if (user.role === 'Assessor') {
    params.push(user.id);
    conditions.push(`created_by = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(
    `SELECT id, serial_no, status, created_by, updated_by, claim_no, reg_no, created_at, updated_at
     FROM datasheets ${where}
     ORDER BY updated_at DESC`,
    params,
  );

  return NextResponse.json({ datasheets: result.rows });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();
  if (!requireRole(user, ['Admin', 'Assessor'])) return forbidden();

  const body = await req.json();
  const formData = body.formData || createDefaultFormData();
  const status = body.status === 'submitted' ? 'submitted' : 'draft';
  const { claimNo, regNo } = extractSearchFields(formData);

  const result = await query(
    `INSERT INTO datasheets (status, created_by, updated_by, form_data, claim_no, reg_no)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [status, user.id, user.id, formData, claimNo, regNo],
  );

  return NextResponse.json({ datasheet: result.rows[0] }, { status: 201 });
}
