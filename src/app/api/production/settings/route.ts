import { NextRequest, NextResponse } from 'next/server';
import { badRequest, forbidden, getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { canManageProductionAdmin } from '@/lib/productionPermissions';
import { getVatRate, setSetting } from '@/lib/productionDb';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    const vatRate = await getVatRate();
    return NextResponse.json({ settings: { vat_rate: vatRate } });
  } catch (err) {
    return handleRouteError(err, 'GET /api/production/settings');
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (!canManageProductionAdmin(user)) return forbidden();
    const body = await req.json();
    if (body.vat_rate != null) {
      const rate = Number(body.vat_rate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
        return badRequest('vat_rate must be between 0 and 1 (e.g. 0.16)');
      }
      await setSetting('vat_rate', String(rate));
    }
    const vatRate = await getVatRate();
    return NextResponse.json({ settings: { vat_rate: vatRate } });
  } catch (err) {
    return handleRouteError(err, 'PATCH /api/production/settings');
  }
}
