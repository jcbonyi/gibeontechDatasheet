import { NextRequest, NextResponse } from 'next/server';
import { listDatasheets } from '@/lib/db';
import { getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { canViewAllDatasheets } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const datasheets = await listDatasheets({
      status: searchParams.get('status') || undefined,
      claimNo: searchParams.get('claimNo') || undefined,
      regNo: searchParams.get('regNo') || undefined,
      assessorId: searchParams.get('assessorId')
        ? Number(searchParams.get('assessorId'))
        : undefined,
      fromDate: searchParams.get('fromDate') || undefined,
      toDate: searchParams.get('toDate') || undefined,
      viewAll: canViewAllDatasheets(user.role),
      scopeUserId: canViewAllDatasheets(user.role) ? undefined : user.id,
    });

    const header = [
      'Serial',
      'Claim No',
      'Reg No',
      'Status',
      'Created By',
      'Assigned To',
      'Updated',
    ];
    const lines = datasheets.map((d) =>
      [
        d.serial_no,
        d.claim_no || '',
        d.reg_no || '',
        d.status,
        d.created_by_name || '',
        d.assigned_to_name || '',
        d.updated_at,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );

    const csv = [header.join(','), ...lines].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="datasheets-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err) {
    return handleRouteError(err, 'GET /api/datasheets/export');
  }
}
