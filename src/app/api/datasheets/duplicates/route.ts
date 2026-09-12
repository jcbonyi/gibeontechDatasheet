import { NextRequest, NextResponse } from 'next/server';
import { listDatasheets } from '@/lib/db';
import { getAuthUser, unauthorized, forbidden } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { canReviewDatasheet, canViewAllDatasheets } from '@/lib/permissions';
import {
  findConflictsForFields,
  findDuplicateGroups,
  type DuplicateCandidate,
} from '@/lib/duplicateDetection';
import { toListItem } from '@/lib/tracking';
import type { DatasheetStatus } from '@/types/datasheet';

function toCandidate(row: ReturnType<typeof toListItem>): DuplicateCandidate {
  return {
    id: row.id,
    serial_no: row.serial_no,
    status: row.status as DatasheetStatus,
    claim_no: row.claim_no,
    reg_no: row.reg_no,
    client_insurer: row.client_insurer,
    form_types: row.form_types,
    assigned_to_name: row.assigned_to_name ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    date_of_instruction: row.date_of_instruction,
    age_days: row.age_days,
  };
}

/**
 * GET /api/datasheets/duplicates
 *   ?claimNo=&regNo=&insurer=&excludeId=  → conflict check for one file
 *   (no params) → all open duplicate groups
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (!canViewAllDatasheets(user.role) && !canReviewDatasheet(user)) {
      return forbidden();
    }

    const { searchParams } = new URL(req.url);
    const claimNo = searchParams.get('claimNo');
    const regNo = searchParams.get('regNo');
    const insurer = searchParams.get('insurer');
    const excludeId = searchParams.get('excludeId')
      ? Number(searchParams.get('excludeId'))
      : undefined;

    const rows = await listDatasheets({ viewAll: true });
    const candidates = rows.map((r) => toCandidate(toListItem(r)));

    if (claimNo != null || regNo != null || insurer != null) {
      const matches = findConflictsForFields(candidates, {
        claim_no: claimNo,
        reg_no: regNo,
        client_insurer: insurer,
        excludeId: Number.isFinite(excludeId) ? excludeId : undefined,
      });
      return NextResponse.json({
        matches,
        count: matches.length,
      });
    }

    const groups = findDuplicateGroups(candidates);
    return NextResponse.json({
      groups,
      groupCount: groups.length,
      duplicateTaskCount: groups.reduce((n, g) => n + g.items.length, 0),
    });
  } catch (err) {
    return handleRouteError(err, 'GET /api/datasheets/duplicates');
  }
}
