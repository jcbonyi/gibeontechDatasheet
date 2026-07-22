import { NextRequest, NextResponse } from 'next/server';
import { badRequest, forbidden, getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import {
  canAccessProduction,
  canManageProductionAdmin,
} from '@/lib/productionPermissions';
import { listInsurers, upsertInsurer } from '@/lib/productionDb';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (!canAccessProduction(user)) return forbidden();
    const activeOnly = new URL(req.url).searchParams.get('active') === '1';
    const insurers = await listInsurers(activeOnly);
    return NextResponse.json({ insurers });
  } catch (err) {
    return handleRouteError(err, 'GET /api/insurers');
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (!canManageProductionAdmin(user)) return forbidden();
    const body = await req.json();
    if (!String(body.name || '').trim()) return badRequest('Name is required');
    const insurer = await upsertInsurer({
      name: body.name,
      contact_person: body.contact_person,
      email: body.email,
      phone: body.phone,
      is_active: body.is_active,
    });
    return NextResponse.json({ insurer }, { status: 201 });
  } catch (err) {
    return handleRouteError(err, 'POST /api/insurers');
  }
}
