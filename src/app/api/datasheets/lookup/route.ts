import { NextRequest, NextResponse } from 'next/server';
import { getDatasheetById, listDatasheets } from '@/lib/db';
import { getAuthUser, unauthorized, badRequest } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { formTypesIncludeAssessment } from '@/lib/copyFromAssessment';
import { mergeFormData, type DatasheetFormData } from '@/types/datasheet';

/**
 * Find prior Assessment datasheets by registration and/or claim number.
 * GET /api/datasheets/lookup?regNo=&claimNo=
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const regNo = (searchParams.get('regNo') || '').trim().toUpperCase();
    const claimNo = (searchParams.get('claimNo') || '').trim();
    if (!regNo && !claimNo) {
      return badRequest('Provide regNo and/or claimNo to look up an Assessment');
    }

    const rows = await listDatasheets({
      regNo: regNo || undefined,
      claimNo: claimNo || undefined,
      viewAll: true,
    });

    const assessments = rows
      .filter((r) => formTypesIncludeAssessment(r.form_types))
      .slice(0, 15)
      .map((r) => ({
        id: r.id,
        serial_no: r.serial_no,
        status: r.status,
        reg_no: r.reg_no,
        claim_no: r.claim_no,
        client_insurer: r.client_insurer,
        form_types: r.form_types,
        updated_at: r.updated_at,
      }));

    // Prefer exact reg match when both filters used
    const ranked = [...assessments].sort((a, b) => {
      const aExact = regNo && (a.reg_no || '').toUpperCase() === regNo ? 1 : 0;
      const bExact = regNo && (b.reg_no || '').toUpperCase() === regNo ? 1 : 0;
      if (bExact !== aExact) return bExact - aExact;
      return String(b.updated_at).localeCompare(String(a.updated_at));
    });

    let formData: DatasheetFormData | null = null;
    let matched: (typeof ranked)[0] | null = ranked[0] || null;
    if (matched) {
      const full = await getDatasheetById(matched.id);
      if (full) {
        formData = mergeFormData(full.form_data as unknown as DatasheetFormData);
      }
    }

    return NextResponse.json({
      matches: ranked,
      matched,
      formData,
    });
  } catch (err) {
    return handleRouteError(err, 'GET /api/datasheets/lookup');
  }
}
