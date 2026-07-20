import { NextRequest, NextResponse } from 'next/server';
import {
  allocateNextSerialNo,
  insertDatasheetRecord,
  isDuplicateSerialError,
  listDatasheets,
  logDatasheetAudit,
} from '@/lib/db';
import { applySeenBy } from '@/lib/auth';
import { getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { canViewAllDatasheets } from '@/lib/permissions';
import { createDefaultFormData, type DatasheetStatus } from '@/types/datasheet';
import { toListItem } from '@/lib/tracking';

function extractSearchFields(formData: Record<string, unknown>) {
  const basic = (formData.basicInfo || {}) as Record<string, string>;
  const inspection = formData.inspection as
    | { vehicleDetails?: { registrationNumber?: string } }
    | undefined;
  return {
    claimNo: basic.claimNo || null,
    regNo: basic.regNo || inspection?.vehicleDetails?.registrationNumber || null,
  };
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

    return NextResponse.json({
      datasheets: datasheets.map(toListItem),
    });
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

    let datasheet = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const serialNo = await allocateNextSerialNo();
      try {
        datasheet = await insertDatasheetRecord({
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
        break;
      } catch (err) {
        if (!isDuplicateSerialError(err) || attempt === 4) throw err;
      }
    }

    if (!datasheet) {
      throw new Error('Failed to allocate a unique serial number');
    }

    await logDatasheetAudit(datasheet.id, user.id, user.name, 'created', { status });

    return NextResponse.json({ datasheet }, { status: 201 });
  } catch (err) {
    return handleRouteError(err, 'POST /api/datasheets');
  }
}
