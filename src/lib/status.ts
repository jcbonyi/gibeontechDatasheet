import type { DatasheetStatus } from '@/types/datasheet';

/** Canonical pipeline for a professional motor assessment / loss adjusting firm. */
export const DATASHEET_STATUSES: DatasheetStatus[] = [
  'instructed',
  'allocated',
  'in_progress',
  'awaiting_documents',
  'submitted',
  'pending_review',
  'under_review',
  'approved',
  'queried',
  'report_issued',
  'on_hold',
  'closed',
  'cancelled',
];

export const STATUS_LABELS: Record<DatasheetStatus, string> = {
  instructed: 'Instructed',
  allocated: 'Allocated',
  in_progress: 'In Progress',
  awaiting_documents: 'Awaiting Documents',
  submitted: 'Submitted',
  pending_review: 'Pending Review',
  under_review: 'Under Review',
  approved: 'Approved',
  queried: 'Queried',
  report_issued: 'Report Issued',
  on_hold: 'On Hold',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

export const STATUS_DESCRIPTIONS: Record<DatasheetStatus, string> = {
  instructed: 'New instruction received — file opened',
  allocated: 'Assigned to an assessor',
  in_progress: 'Assessment / inspection underway',
  awaiting_documents: 'Waiting for documents from insurer or insured',
  submitted: 'Assessor has submitted the file',
  pending_review: 'Submitted for internal technical review',
  under_review: 'Being reviewed by operations / principal',
  approved: 'Internally approved — ready for report issue',
  queried: 'Clarification or amendments required',
  report_issued: 'Final report issued to the client',
  on_hold: 'Temporarily suspended',
  closed: 'File closed',
  cancelled: 'Instruction cancelled',
};

/** Tailwind badge class suffix keys used in globals.css */
export const STATUS_BADGE_CLASS: Record<DatasheetStatus, string> = {
  instructed: 'status-instructed',
  allocated: 'status-allocated',
  in_progress: 'status-in-progress',
  awaiting_documents: 'status-awaiting',
  submitted: 'status-submitted',
  pending_review: 'status-pending-review',
  under_review: 'status-under-review',
  approved: 'status-approved',
  queried: 'status-queried',
  report_issued: 'status-report-issued',
  on_hold: 'status-on-hold',
  closed: 'status-closed',
  cancelled: 'status-cancelled',
};

/** Board columns for the task tracker (excludes terminal noise). */
export const BOARD_STATUSES: DatasheetStatus[] = [
  'instructed',
  'allocated',
  'in_progress',
  'awaiting_documents',
  'submitted',
  'pending_review',
  'under_review',
  'approved',
  'queried',
  'on_hold',
  'report_issued',
];

/** Statuses that still count as open work for ageing / SLA. */
export const OPEN_STATUSES: DatasheetStatus[] = [
  'instructed',
  'allocated',
  'in_progress',
  'awaiting_documents',
  'submitted',
  'pending_review',
  'under_review',
  'approved',
  'queried',
  'on_hold',
];

/** Assessor can edit the form while in these statuses. */
export const ASSESSOR_EDITABLE_STATUSES: DatasheetStatus[] = [
  'instructed',
  'allocated',
  'in_progress',
  'awaiting_documents',
  'queried',
  'on_hold',
];

/** Statuses an Assessor may move a task into (inclusive of Pending Review). */
export const ASSESSOR_TARGET_STATUSES: DatasheetStatus[] = [
  'in_progress',
  'awaiting_documents',
  'submitted',
  'pending_review',
];

/** Terminal / completed — locked unless reopened. */
export const TERMINAL_STATUSES: DatasheetStatus[] = [
  'report_issued',
  'closed',
  'cancelled',
];

const LEGACY_STATUS_MAP: Record<string, DatasheetStatus> = {
  draft: 'instructed',
};

export function normalizeStatus(raw: string | null | undefined): DatasheetStatus {
  if (!raw) return 'instructed';
  if (LEGACY_STATUS_MAP[raw]) return LEGACY_STATUS_MAP[raw];
  if ((DATASHEET_STATUSES as string[]).includes(raw)) return raw as DatasheetStatus;
  return 'instructed';
}

export function statusLabel(status: string): string {
  const n = normalizeStatus(status);
  return STATUS_LABELS[n];
}

export function isOpenStatus(status: string): boolean {
  return OPEN_STATUSES.includes(normalizeStatus(status));
}

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.includes(normalizeStatus(status));
}

export interface StatusAction {
  status: DatasheetStatus;
  label: string;
  /** Who may perform this transition (beyond transition graph). */
  roles: Array<'Admin' | 'PrincipalOfficer' | 'OperationsManager' | 'Assessor'>;
  variant?: 'primary' | 'secondary' | 'danger';
}

/** Allowed next statuses from a given status (workflow graph). */
export const STATUS_TRANSITIONS: Record<DatasheetStatus, DatasheetStatus[]> = {
  instructed: ['allocated', 'in_progress', 'awaiting_documents', 'on_hold', 'cancelled'],
  allocated: ['in_progress', 'awaiting_documents', 'on_hold', 'cancelled'],
  in_progress: ['awaiting_documents', 'submitted', 'pending_review', 'on_hold', 'queried'],
  awaiting_documents: ['in_progress', 'submitted', 'pending_review', 'on_hold', 'cancelled'],
  submitted: ['pending_review', 'under_review', 'queried', 'on_hold'],
  pending_review: ['under_review', 'approved', 'queried', 'report_issued', 'on_hold'],
  under_review: ['approved', 'queried', 'pending_review', 'report_issued', 'on_hold'],
  approved: ['report_issued', 'closed', 'queried'],
  queried: ['in_progress', 'awaiting_documents', 'submitted', 'pending_review', 'on_hold'],
  report_issued: ['closed', 'queried'],
  on_hold: ['in_progress', 'awaiting_documents', 'allocated', 'cancelled'],
  closed: [],
  cancelled: [],
};

export function getAvailableTransitions(from: DatasheetStatus): DatasheetStatus[] {
  return STATUS_TRANSITIONS[normalizeStatus(from)] || [];
}
