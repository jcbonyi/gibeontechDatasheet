import { NextRequest, NextResponse } from 'next/server';
import { forbidden, getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { canAccessProduction } from '@/lib/productionPermissions';
import { listNotifications, markNotificationRead } from '@/lib/productionDb';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (!canAccessProduction(user)) return forbidden();
    const notifications = await listNotifications(user.id);
    return NextResponse.json({ notifications });
  } catch (err) {
    return handleRouteError(err, 'GET /api/notifications');
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    const body = await req.json();
    const id = Number(body.id);
    if (!id) return NextResponse.json({ message: 'id required' }, { status: 400 });
    await markNotificationRead(id, user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err, 'PATCH /api/notifications');
  }
}
