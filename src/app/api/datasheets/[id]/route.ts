import { NextRequest, NextResponse } from 'next/server';
import {
  getDatasheetAuditLog,
  getDatasheetById,
  getActiveUsers,
  logDatasheetAudit,
  updateDatasheetRecord,
  deleteDatasheetRecord,
} from '@/lib/db';
import { applySeenBy, canViewDatasheet } from '@/lib/auth';
import { forbidden, getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import {
  canDeleteDatasheet,
  canEditDatasheet,
  getDatasheetPermissions,
} from '@/lib/permissions';
import type { DatasheetStatus } from '@/types/datasheet';
import { extractDenormalizedFields } from '@/lib/extractFields';

export async function GET(
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

    const permissions = getDatasheetPermissions(user, datasheet);
    const audit = await getDatasheetAuditLog(datasheet.id);
    const users = await getActiveUsers();
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    return NextResponse.json({
      datasheet: {
        ...datasheet,
        created_by_name: datasheet.created_by ? userMap.get(datasheet.created_by) || null : null,
        assigned_to_name: datasheet.assigned_to ? userMap.get(datasheet.assigned_to) || null : null,
        reviewed_by_name: datasheet.reviewed_by
          ? userMap.get(datasheet.reviewed_by) || null
          : null,
      },
      permissions,
      audit,
    });
  } catch (err) {
    return handleRouteError(err, 'GET /api/datasheets/[id]');
  }
}

export async function PATCH(
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
    if (!canEditDatasheet(user, datasheet)) return forbidden();

    const body = await req.json();
    let formData = (body.formData ?? datasheet.form_data) as Record<string, unknown>;
    let status = (body.status ?? datasheet.status) as DatasheetStatus;
    if ((status as string) === 'draft') status = 'instructed';
    if ((status as string) === 'submitted') status = 'pending_review';
    if ((status as string) === 'approved') status = 'report_issued';

    if ((status === 'report_issued' || status === 'closed') && user.role === 'OperationsManager') {
      return forbidden();
    }

    formData = applySeenBy(formData, user.name);
    const denorm = extractDenormalizedFields(formData, datasheet.serial_no);

    const updated = await updateDatasheetRecord(Number(id), {
      status,
      updated_by: user.id,
      form_data: formData,
      claim_no: denorm.claim_no,
      reg_no: denorm.reg_no,
      date_of_instruction: denorm.date_of_instruction,
      client_insurer: denorm.client_insurer,
      form_types: denorm.form_types,
      search_text: denorm.search_text,
    });

    await logDatasheetAudit(datasheet.id, user.id, user.name, 'updated', {
      status,
      previousStatus: datasheet.status,
    });

    return NextResponse.json({ datasheet: updated });
  } catch (err) {
    return handleRouteError(err, 'PATCH /api/datasheets/[id]');
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (!canDeleteDatasheet(user)) return forbidden();

    const { id } = await params;
    const datasheet = await getDatasheetById(Number(id));
    if (!datasheet) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    await logDatasheetAudit(datasheet.id, user.id, user.name, 'deleted', {
      serial: datasheet.serial_no,
      status: datasheet.status,
    });
    await deleteDatasheetRecord(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err, 'DELETE /api/datasheets/[id]');
  }
}
