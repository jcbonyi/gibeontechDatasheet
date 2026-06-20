import { NextRequest, NextResponse } from 'next/server';
import {
  getDatasheetById,
  insertDatasheetRecord,
  listDatasheets,
  logDatasheetAudit,
  query,
} from '@/lib/db';
import { applySeenBy } from '@/lib/auth';
import { getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { canViewAllDatasheets } from '@/lib/permissions';
import { createDefaultFormData, type DatasheetStatus } from '@/types/datasheet';

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
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const datasheets = await listDatasheets({
      status: searchParams.get('status') || undefined,
      claimNo: searchParams.get('claimNo') || undefined,
      regNo: searchParams.get('regNo') || undefined,
      assessorId: searchParams.get('assessorId')
        ? Number(searchParams.get('assessorId'))
        : undefined,
      fromDate: searchParams.get('fromDate') || undefined,
      toDate: searchParams.get('toDate') || undefined,
      viewAll: canViewAllDatasheets(user.role),
      scopeUserId: canViewAllDatasheets(user.role) ? undefined : user.id,
    });

    return NextResponse.json({ datasheets });
  } catch (err) {
    return handleRouteError(err, 'GET /api/datasheets');
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const body = await req.json();
    let formData = (body.formData || createDefaultFormData()) as Record<string, unknown>;
    const status = (body.status === 'submitted' ? 'submitted' : 'draft') as DatasheetStatus;
    formData = applySeenBy(formData, user.name);

    const { claimNo, regNo } = extractSearchFields(formData);
    const serialNo = await nextSerialNo();

    const datasheet = await insertDatasheetRecord({
      serial_no: serialNo,
      status,
      created_by: user.id,
      updated_by: user.id,
      form_data: formData,
      claim_no: claimNo,
      reg_no: regNo,
      assigned_to: null,
      assigned_by: null,
      assigned_at: null,
      reopen_reason: null,
    });

    await logDatasheetAudit(datasheet.id, user.id, user.name, 'created', { status });

    return NextResponse.json({ datasheet }, { status: 201 });
  } catch (err) {
    return handleRouteError(err, 'POST /api/datasheets');
  }
}
