import { NextRequest, NextResponse } from 'next/server';
import { getActiveUsers } from '@/lib/db';
import { getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { canAssignDatasheet } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (!canAssignDatasheet(user)) {
      return NextResponse.json({ assessors: [] });
    }

    const assessors = await getActiveUsers('Assessor');
    return NextResponse.json({ assessors });
  } catch (err) {
    return handleRouteError(err, 'GET /api/users/assessors');
  }
}
