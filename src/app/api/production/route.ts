import { NextRequest, NextResponse } from 'next/server';
import { badRequest, forbidden, getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import {
  canAccessProduction,
  canManageProduction,
} from '@/lib/productionPermissions';
import {
  createNotification,
  createProductionEntry,
  listProductionEntries,
  listTargets,
} from '@/lib/productionDb';
import { PRODUCTION_STATUSES, normalizeAssignment, type ProductionStatus } from '@/lib/productionConfig';
import { buildProductionSummary } from '@/lib/productionAnalytics';


function parseFilters(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  return {
    fromDate: searchParams.get('fromDate') || undefined,
    toDate: searchParams.get('toDate') || undefined,
    insurerId: searchParams.get('insurerId')
      ? Number(searchParams.get('insurerId'))
      : undefined,
    doneByUserId: searchParams.get('doneBy')
      ? Number(searchParams.get('doneBy'))
      : undefined,
    seenByUserId: searchParams.get('seenBy')
      ? Number(searchParams.get('seenBy'))
      : undefined,
    instructedByUserId: searchParams.get('instructedBy')
      ? Number(searchParams.get('instructedBy'))
      : undefined,
    registrationNumber: searchParams.get('regNo') || undefined,
    status: searchParams.get('status') || undefined,
    q: searchParams.get('q') || undefined,
  };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (!canAccessProduction(user)) return forbidden();

    const filters = parseFilters(req);
    if (!canManageProduction(user)) {
      // Staff see all completed register for transparency; still full list for production ops
    }
    const entries = await listProductionEntries(filters);
    return NextResponse.json({ entries });
  } catch (err) {
    return handleRouteError(err, 'GET /api/production');
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (!canAccessProduction(user)) return forbidden();

    const body = await req.json();
    const production_date = String(body.production_date || '').slice(0, 10);
    const insurer_id = Number(body.insurer_id);
    const registration_number = String(body.registration_number || '').trim();
    const amount = Number(body.amount);
    const status = String(body.status || 'completed') as ProductionStatus;

    if (!production_date || !insurer_id || !registration_number) {
      return badRequest('Date, insurer, and registration number are required');
    }
    if (!Number.isFinite(amount) || amount < 0) return badRequest('Valid amount is required');
    if (!PRODUCTION_STATUSES.includes(status)) return badRequest('Invalid status');

    const assignment = normalizeAssignment(body.assignment);
    if (body.assignment != null && String(body.assignment).trim() && !assignment) {
      return badRequest(
        'Assignment must be one of: Assessment, Re-Inspection, Pre-Theft, Technical',
      );
    }

    const entry = await createProductionEntry(
      {
        production_date,
        insurer_id,
        registration_number,
        assignment,
        amount,
        done_by_user_id: body.done_by_user_id ? Number(body.done_by_user_id) : null,
        seen_by_user_id: body.seen_by_user_id ? Number(body.seen_by_user_id) : null,
        instructed_by_user_id: body.instructed_by_user_id
          ? Number(body.instructed_by_user_id)
          : null,
        remarks: body.remarks,
        status,
      },
      user.id,
    );

    await createNotification({
      type: 'production_created',
      title: 'New production entered',
      body: `${entry.registration_number} · ${entry.amount} · ${entry.production_date}`,
    });

    // Target checks
    const all = await listProductionEntries({});
    const targets = await listTargets();
    const summary = buildProductionSummary(all, targets);
    for (const [period, pack] of Object.entries(summary.targets)) {
      if (pack?.met) {
        await createNotification({
          type: `${period}_target_achieved`,
          title: `${period[0].toUpperCase()}${period.slice(1)} production target achieved`,
          body: `${pack.jobs} jobs · ${pack.amount.toLocaleString()} (target ${pack.targetJobs} / ${pack.targetAmount})`,
        });
      }
    }

    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    return handleRouteError(err, 'POST /api/production');
  }
}
