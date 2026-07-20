import { NextRequest, NextResponse } from 'next/server';
import { getAssignableUsers } from '@/lib/db';
import { getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { canAssignDatasheet } from '@/lib/permissions';
import { ROLE_LABELS } from '@/types/datasheet';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (!canAssignDatasheet(user)) {
      return NextResponse.json({ assessors: [] });
    }

    const users = await getAssignableUsers();
    const assessors = users.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      roleLabel: ROLE_LABELS[u.role],
    }));

    return NextResponse.json({ assessors });
  } catch (err) {
    return handleRouteError(err, 'GET /api/users/assessors');
  }
}
