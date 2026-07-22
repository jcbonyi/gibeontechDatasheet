import { NextRequest, NextResponse } from 'next/server';
import { badRequest, forbidden, getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { canManageProductionAdmin } from '@/lib/productionPermissions';
import { upsertInsurer } from '@/lib/productionDb';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (!canManageProductionAdmin(user)) return forbidden();
    const { id } = await params;
    const body = await req.json();
    if (!String(body.name || '').trim()) return badRequest('Name is required');
    const insurer = await upsertInsurer({
      id: Number(id),
      name: body.name,
      contact_person: body.contact_person,
      email: body.email,
      phone: body.phone,
      is_active: body.is_active,
    });
    return NextResponse.json({ insurer });
  } catch (err) {
    return handleRouteError(err, 'PATCH /api/insurers/[id]');
  }
}
