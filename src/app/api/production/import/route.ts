import { NextRequest, NextResponse } from 'next/server';
import { badRequest, forbidden, getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { canManageProduction } from '@/lib/productionPermissions';
import { getActiveUsers } from '@/lib/db';
import {
  createProductionEntry,
  listInsurers,
  upsertInsurer,
} from '@/lib/productionDb';
import {
  buildImportTemplateBuffer,
  matchUserId,
  parseProductionWorkbook,
  toEntryInput,
} from '@/lib/productionImport';

export async function GET() {
  try {
    const buffer = await buildImportTemplateBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="production-import-template.xlsx"',
      },
    });
  } catch (err) {
    return handleRouteError(err, 'GET /api/production/import');
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (!canManageProduction(user)) return forbidden();

    const form = await req.formData();
    const file = form.get('file');
    if (!file || !(file instanceof File)) {
      return badRequest('Upload an Excel file (.xlsx) using the file field');
    }
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xlsm')) {
      return badRequest('Only .xlsx Excel files are supported');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseProductionWorkbook(buffer);
    if (!parsed.rows.length && parsed.errors.length) {
      return NextResponse.json(
        {
          message: 'Import failed',
          imported: 0,
          failed: parsed.errors.length,
          errors: parsed.errors,
          warnings: [],
        },
        { status: 400 },
      );
    }

    const insurers = await listInsurers(false);
    const insurerByName = new Map(
      insurers.map((i) => [i.name.trim().toLowerCase(), i]),
    );
    const staff = (await getActiveUsers()).map((u) => ({ id: u.id, name: u.name }));

    let imported = 0;
    const errors = [...parsed.errors];
    const warnings: { row: number; message: string }[] = [];

    for (const row of parsed.rows) {
      try {
        const key = row.insurer_name.trim().toLowerCase();
        let insurer = insurerByName.get(key);
        if (!insurer) {
          insurer = await upsertInsurer({ name: row.insurer_name.trim(), is_active: true });
          insurerByName.set(key, insurer);
          warnings.push({
            row: row.rowNumber,
            message: `Created insurer "${insurer.name}"`,
          });
        }

        const done = matchUserId(row.done_by_name, staff);
        const seen = matchUserId(row.seen_by_name, staff);
        const instructed = matchUserId(row.instructed_by_name, staff);
        for (const m of [done, seen, instructed]) {
          if (m.warning) warnings.push({ row: row.rowNumber, message: m.warning });
        }

        await createProductionEntry(
          toEntryInput(row, insurer.id, done.id, seen.id, instructed.id),
          user.id,
        );
        imported += 1;
      } catch (err) {
        errors.push({
          row: row.rowNumber,
          message: err instanceof Error ? err.message : 'Failed to import row',
        });
      }
    }

    return NextResponse.json({
      message: `Imported ${imported} of ${parsed.rows.length} rows`,
      imported,
      total: parsed.rows.length,
      failed: errors.length,
      errors: errors.slice(0, 50),
      warnings: warnings.slice(0, 50),
    });
  } catch (err) {
    return handleRouteError(err, 'POST /api/production/import');
  }
}
