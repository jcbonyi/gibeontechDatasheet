import type { FormType } from '@/types/datasheet';

export interface DenormalizedFields {
  claim_no: string | null;
  reg_no: string | null;
  date_of_instruction: string | null;
  client_insurer: string | null;
  form_types: string | null;
  search_text: string | null;
}

export function extractDenormalizedFields(
  formData: Record<string, unknown> | null | undefined,
  serialNo?: string | null,
): DenormalizedFields {
  const basic = (formData?.basicInfo || {}) as Record<string, string>;
  const header = (formData?.header || {}) as { formTypes?: FormType[] };
  const inspection = formData?.inspection as
    | { vehicleDetails?: { registrationNumber?: string; chassisNumber?: string } }
    | undefined;

  const formTypes = Array.isArray(header.formTypes) ? header.formTypes : [];
  const claimNo = basic.claimNo?.trim() || null;
  const regNo =
    basic.regNo?.trim() ||
    inspection?.vehicleDetails?.registrationNumber?.trim() ||
    null;
  const clientInsurer = basic.clientInsurer?.trim() || null;
  const dateOfInstruction = basic.dateOfInstruction?.trim() || null;

  const searchParts = [
    serialNo,
    claimNo,
    regNo,
    clientInsurer,
    basic.ownerInsured,
    basic.chassisNo || inspection?.vehicleDetails?.chassisNumber,
    basic.engineNo,
    basic.policyNo,
    basic.instructedBy,
    formTypes.join(' '),
  ]
    .filter(Boolean)
    .map((s) => String(s).trim());

  return {
    claim_no: claimNo,
    reg_no: regNo,
    date_of_instruction: dateOfInstruction,
    client_insurer: clientInsurer,
    form_types: formTypes.length ? formTypes.join(',') : null,
    search_text: searchParts.join(' ').toLowerCase() || null,
  };
}
