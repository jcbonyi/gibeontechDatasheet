import { NextRequest, NextResponse } from 'next/server';
import { forbidden, getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { wipeAllProductionData } from '@/lib/productionDb';

/** Admin-only: delete all production entries, insurers, targets, and notifications. */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (user.role !== 'Admin') return forbidden();

    const confirm = req.nextUrl.searchParams.get('confirm');
    if (confirm !== 'DELETE_ALL_PRODUCTION') {
      return NextResponse.json(
        {
          message:
            'Pass ?confirm=DELETE_ALL_PRODUCTION to wipe production data. This cannot be undone.',
        },
        { status: 400 },
      );
    }

    const counts = await wipeAllProductionData();
    return NextResponse.json({
      message: 'All production module data has been deleted',
      deleted: counts,
    });
  } catch (err) {
    return handleRouteError(err, 'DELETE /api/production/wipe');
  }
}
