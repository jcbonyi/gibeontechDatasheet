import { NextRequest, NextResponse } from 'next/server';
import { badRequest, forbidden, getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import {
  canAccessProduction,
  canDeleteProductionEntry,
  canEditProductionEntry,
} from '@/lib/productionPermissions';
import {
  deleteProductionEntry,
  getProductionEntry,
  updateProductionEntry,
} from '@/lib/productionDb';
import { PRODUCTION_STATUSES, normalizeAssignment, type ProductionStatus } from '@/lib/productionConfig';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (!canAccessProduction(user)) return forbidden();
    const { id } = await params;
    const entry = await getProductionEntry(Number(id));
    if (!entry) return NextResponse.json({ message: 'Not found' }, { status: 404 });
    return NextResponse.json({ entry });
  } catch (err) {
    return handleRouteError(err, 'GET /api/production/[id]');
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (!canAccessProduction(user)) return forbidden();
    const { id } = await params;
    const existing = await getProductionEntry(Number(id));
    if (!existing) return NextResponse.json({ message: 'Not found' }, { status: 404 });
    if (!canEditProductionEntry(user, existing.created_by)) return forbidden();

    const body = await req.json();
    const production_date = String(body.production_date || existing.production_date).slice(0, 10);
    const insurer_id = Number(body.insurer_id ?? existing.insurer_id);
    const registration_number = String(
      body.registration_number ?? existing.registration_number,
    ).trim();
    const amount = Number(body.amount ?? existing.amount);
    const status = String(body.status ?? existing.status) as ProductionStatus;
    const assignmentRaw =
      body.assignment !== undefined ? body.assignment : existing.assignment;
    const assignment = normalizeAssignment(assignmentRaw);
    if (
      assignmentRaw != null &&
      String(assignmentRaw).trim() &&
      !assignment
    ) {
      return badRequest(
        'Assignment must be one of: Assessment, Re-Inspection, Pre-Theft, Technical',
      );
    }

    if (!production_date || !insurer_id || !registration_number) {
      return badRequest('Date, insurer, and registration number are required');
    }
    if (!Number.isFinite(amount) || amount < 0) return badRequest('Valid amount is required');
    if (!PRODUCTION_STATUSES.includes(status)) return badRequest('Invalid status');

    const entry = await updateProductionEntry(
      Number(id),
      {
        production_date,
        insurer_id,
        registration_number,
        assignment,
        amount,
        done_by_user_id:
          body.done_by_user_id !== undefined
            ? body.done_by_user_id
              ? Number(body.done_by_user_id)
              : null
            : existing.done_by_user_id,
        seen_by_user_id:
          body.seen_by_user_id !== undefined
            ? body.seen_by_user_id
              ? Number(body.seen_by_user_id)
              : null
            : existing.seen_by_user_id,
        instructed_by_user_id:
          body.instructed_by_user_id !== undefined
            ? body.instructed_by_user_id
              ? Number(body.instructed_by_user_id)
              : null
            : existing.instructed_by_user_id,
        remarks: body.remarks !== undefined ? body.remarks : existing.remarks,
        status,
      },
      user.id,
    );
    return NextResponse.json({ entry });
  } catch (err) {
    return handleRouteError(err, 'PATCH /api/production/[id]');
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (!canDeleteProductionEntry(user)) return forbidden();
    const { id } = await params;
    const ok = await deleteProductionEntry(Number(id));
    if (!ok) return NextResponse.json({ message: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err, 'DELETE /api/production/[id]');
  }
}
