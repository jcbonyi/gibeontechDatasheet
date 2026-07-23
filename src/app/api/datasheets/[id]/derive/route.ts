import { NextRequest, NextResponse } from 'next/server';
import {
  allocateNextSerialNo,
  getDatasheetById,
  insertDatasheetRecord,
  isDuplicateSerialError,
  logDatasheetAudit,
} from '@/lib/db';
import { applySeenBy, canViewDatasheet } from '@/lib/auth';
import { badRequest, forbidden, getAuthUser, unauthorized } from '@/lib/api';
import { handleRouteError } from '@/lib/routeErrors';
import { buildFollowUpFromAssessment } from '@/lib/copyFromAssessment';
import { extractDenormalizedFields } from '@/lib/extractFields';
import { mergeFormData, type DatasheetFormData, type FormType } from '@/types/datasheet';

const FOLLOW_UP_TYPES: FormType[] = ['Re-inspection', 'Supplementary', 'Pre-theft'];

/**
 * Create a Re-inspection / Supplementary / Pre-theft datasheet from an existing Assessment.
 * POST /api/datasheets/[id]/derive  { formType: 'Re-inspection' | 'Supplementary' | 'Pre-theft' }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();

    const { id } = await params;
    const source = await getDatasheetById(Number(id));
    if (!source) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }
    if (!canViewDatasheet(user, source)) return forbidden();

    const body = await req.json();
    const formType = String(body.formType || '') as FormType;
    if (!FOLLOW_UP_TYPES.includes(formType)) {
      return badRequest('formType must be Re-inspection, Supplementary, or Pre-theft');
    }
    const followUpType = formType as 'Re-inspection' | 'Supplementary' | 'Pre-theft';

    const sourceForm = mergeFormData(source.form_data as unknown as DatasheetFormData);
    let formData = buildFollowUpFromAssessment(sourceForm, followUpType, {
      sourceSerial: source.serial_no,
      seenBy: user.role === 'Assessor' ? user.name : '',
    });
    formData = applySeenBy(
      formData as unknown as Record<string, unknown>,
      user.name,
      user.role,
    ) as unknown as DatasheetFormData;

    let datasheet = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const serialNo = await allocateNextSerialNo();
      const denorm = extractDenormalizedFields(formData as unknown as Record<string, unknown>, serialNo);
      try {
        datasheet = await insertDatasheetRecord({
          serial_no: serialNo,
          status: 'instructed',
          created_by: user.id,
          updated_by: user.id,
          form_data: formData as unknown as Record<string, unknown>,
          claim_no: denorm.claim_no,
          reg_no: denorm.reg_no,
          assigned_to: null,
          assigned_by: null,
          assigned_at: null,
          done_by: null,
          reopen_reason: null,
          date_of_instruction: denorm.date_of_instruction,
          client_insurer: denorm.client_insurer,
          form_types: denorm.form_types,
          cancel_reason: null,
          query_reason: null,
          reviewed_by: null,
          reviewed_at: null,
          search_text: denorm.search_text,
          delay_notes: [],
        });
        break;
      } catch (err) {
        if (!isDuplicateSerialError(err) || attempt === 4) throw err;
      }
    }

    if (!datasheet) {
      throw new Error('Failed to allocate a unique serial number');
    }

    await logDatasheetAudit(datasheet.id, user.id, user.name, 'derived', {
      sourceId: source.id,
      sourceSerial: source.serial_no,
      formType,
    });

    return NextResponse.json({ datasheet }, { status: 201 });
  } catch (err) {
    return handleRouteError(err, 'POST /api/datasheets/[id]/derive');
  }
}
