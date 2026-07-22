import { NextRequest, NextResponse } from 'next/server';
import { forbidden, getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { canAccessProduction } from '@/lib/productionPermissions';
import { getActiveUsers } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (!canAccessProduction(user)) return forbidden();
    const users = await getActiveUsers();
    return NextResponse.json({
      staff: users.map((u) => ({ id: u.id, name: u.name, role: u.role })),
    });
  } catch (err) {
    return handleRouteError(err, 'GET /api/production/staff');
  }
}
