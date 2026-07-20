import type { FormType } from '@/types/datasheet';

export const CANCEL_REASONS = [
  { value: 'instruction_withdrawn', label: 'Instruction withdrawn by insurer' },
  { value: 'duplicate_file', label: 'Duplicate file / already instructed' },
  { value: 'wrong_assessor_firm', label: 'Referred to another firm' },
  { value: 'vehicle_not_available', label: 'Vehicle not available for inspection' },
  { value: 'claim_repudiated', label: 'Claim repudiated / closed by insurer' },
  { value: 'other', label: 'Other (see notes)' },
] as const;

export type CancelReasonCode = (typeof CANCEL_REASONS)[number]['value'];

export function cancelReasonLabel(code: string | null | undefined): string {
  return CANCEL_REASONS.find((r) => r.value === code)?.label || code || '—';
}

/** Document / evidence checklist templates by form type (guidance + recommended docs). */
export interface ChecklistTemplateItem {
  key: string;
  label: string;
  required: boolean;
}

export const FORM_TYPE_CHECKLISTS: Record<FormType, ChecklistTemplateItem[]> = {
  Assessment: [
    { key: 'claim_form', label: 'Claim Form', required: true },
    { key: 'police_abstract', label: 'Police Abstract', required: true },
    { key: 'logbook', label: 'Logbook Copy', required: true },
    { key: 'driver_statement', label: "Driver's Statement", required: false },
    { key: 'repair_quotation', label: 'Repair Quotation', required: true },
    { key: 'photos_damage', label: 'Damage photos (front/rear/sides)', required: true },
    { key: 'odometer', label: 'Odometer reading photo', required: false },
  ],
  'Re-inspection': [
    { key: 'prior_report', label: 'Prior assessment report', required: true },
    { key: 'repair_quotation', label: 'Updated repair quotation', required: true },
    { key: 'photos_progress', label: 'Repair progress photos', required: true },
    { key: 'parts_invoices', label: 'Parts / labour invoices', required: false },
  ],
  Supplementary: [
    { key: 'prior_report', label: 'Original / prior report', required: true },
    { key: 'supplementary_quote', label: 'Supplementary quotation', required: true },
    { key: 'photos_additional', label: 'Photos of additional damage', required: true },
  ],
  Technical: [
    { key: 'technical_brief', label: 'Technical instruction / brief', required: true },
    { key: 'photos_component', label: 'Component / system photos', required: true },
    { key: 'diagnostic_printout', label: 'Diagnostic printout (if applicable)', required: false },
  ],
  Inspection: [
    { key: 'instruction_letter', label: 'Inspection instruction', required: true },
    { key: 'logbook', label: 'Logbook Copy', required: true },
    { key: 'photos_overview', label: 'Overview photos (4 angles)', required: true },
    { key: 'photos_interior', label: 'Interior / odometer photos', required: true },
  ],
};

export function getChecklistForFormTypes(formTypes: FormType[]): ChecklistTemplateItem[] {
  const map = new Map<string, ChecklistTemplateItem>();
  const types = formTypes.length ? formTypes : (['Assessment'] as FormType[]);
  for (const t of types) {
    for (const item of FORM_TYPE_CHECKLISTS[t] || []) {
      const existing = map.get(item.key);
      if (!existing || item.required) map.set(item.key, item);
    }
  }
  return [...map.values()];
}

export const SAVED_VIEWS = [
  { id: 'my_open', label: 'My open', scope: 'mine' as const, openOnly: true },
  { id: 'unallocated', label: 'Unallocated', scope: 'unallocated' as const, openOnly: true },
  { id: 'overdue', label: 'Overdue', scope: 'overdue' as const, openOnly: true },
  { id: 'pending_review', label: 'Pending review', status: 'pending_review' as const, openOnly: false },
  { id: 'queried', label: 'Queried', status: 'queried' as const, openOnly: false },
  { id: 'under_review', label: 'Under review', status: 'under_review' as const, openOnly: false },
  { id: 'in_progress', label: 'In progress', status: 'in_progress' as const, openOnly: false },
  { id: 'all_open', label: 'All open', scope: 'all' as const, openOnly: true },
] as const;

export type SavedViewId = (typeof SAVED_VIEWS)[number]['id'];
