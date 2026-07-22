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
import { extractDenormalizedFields } from '@/lib/extractFields';

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
      q: searchParams.get('q') || undefined,
      insurer: searchParams.get('insurer') || undefined,
      unallocated: searchParams.get('unallocated') === '1',
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
    const status = (
      body.status === 'pending_review' || body.status === 'submitted'
        ? 'pending_review'
        : body.status === 'in_progress'
          ? 'in_progress'
          : 'instructed'
    ) as DatasheetStatus;
    formData = applySeenBy(formData, user.name, user.role);

    let datasheet = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const serialNo = await allocateNextSerialNo();
      const denorm = extractDenormalizedFields(formData, serialNo);
      try {
        datasheet = await insertDatasheetRecord({
          serial_no: serialNo,
          status,
          created_by: user.id,
          updated_by: user.id,
          form_data: formData,
          claim_no: denorm.claim_no,
          reg_no: denorm.reg_no,
          assigned_to: null,
          assigned_by: null,
          assigned_at: null,
          reopen_reason: null,
          date_of_instruction: denorm.date_of_instruction,
          client_insurer: denorm.client_insurer,
          form_types: denorm.form_types,
          cancel_reason: null,
          query_reason: null,
          delay_notes: [],
          reviewed_by: null,
          reviewed_at: null,
          search_text: denorm.search_text,
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
