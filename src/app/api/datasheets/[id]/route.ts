import { NextRequest, NextResponse } from 'next/server';
import {
  getDatasheetAuditLog,
  getDatasheetById,
  getActiveUsers,
  logDatasheetAudit,
  updateDatasheetRecord,
  query,
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
    const status = (body.status ?? datasheet.status) as DatasheetStatus;

    if (status === 'approved' && user.role === 'OperationsManager') {
      return forbidden();
    }

    formData = applySeenBy(formData, user.name);
    const { claimNo, regNo } = extractSearchFields(formData);

    const updated = await updateDatasheetRecord(Number(id), {
      status,
      updated_by: user.id,
      form_data: formData,
      claim_no: claimNo,
      reg_no: regNo,
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
      serial_no: datasheet.serial_no,
    });
    await query('DELETE FROM datasheets WHERE id = $1', [Number(id)]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err, 'DELETE /api/datasheets/[id]');
  }
}
