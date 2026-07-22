'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { DatasheetForm } from '@/components/DatasheetForm';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { DatasheetFormData, mergeFormData, ROLE_LABELS, type DatasheetStatus, type UserRole } from '@/types/datasheet';
import { STATUS_DESCRIPTIONS, STATUS_LABELS } from '@/lib/status';
import { useAuth } from '@/context/AuthContext';
import { fetchJson } from '@/lib/fetchJson';
import { canAssignDatasheet, canDeleteDatasheet } from '@/lib/permissions';
import { Trash2, UserPlus } from 'lucide-react';
import { DelayNotesPanel } from '@/components/DelayNotesPanel';
import { normalizeDelayNotes, type DelayNote } from '@/lib/opsConfig';

interface WorkflowAction {
  status: DatasheetStatus;
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
}

interface DatasheetPermissions {
  canEdit: boolean;
  canAssign: boolean;
  canReopen: boolean;
  canMarkUnderReview: boolean;
  canApprove: boolean;
  canIssueReport: boolean;
  canDuplicate: boolean;
  canDelete: boolean;
  workflowActions: WorkflowAction[];
}

interface AuditEntry {
  id: number;
  action: string;
  user_name: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export default function EditDatasheetPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = Number(params.id);
  const [formData, setFormData] = useState<DatasheetFormData | null>(null);
  const [serialNo, setSerialNo] = useState('');
  const [status, setStatus] = useState<DatasheetStatus>('instructed');
  const [assignedToName, setAssignedToName] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<DatasheetPermissions | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [delayNotes, setDelayNotes] = useState<DelayNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [assignees, setAssignees] = useState<{ id: number; name: string; role: UserRole; roleLabel?: string }[]>([]);
  const [assignTo, setAssignTo] = useState('');

  const canDelete = user ? canDeleteDatasheet(user) : false;
  const canAssign = user ? canAssignDatasheet(user) : false;

  const reload = () => {
    fetchJson<{
      message?: string;
      datasheet: {
        form_data: DatasheetFormData;
        serial_no: string;
        status: DatasheetStatus;
        assigned_to_name?: string | null;
        delay_notes?: unknown;
      };
      permissions: DatasheetPermissions;
      audit: AuditEntry[];
    }>(`/api/datasheets/${id}`)
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.message || 'Failed to load');
        const loaded = mergeFormData(data.datasheet.form_data as DatasheetFormData);
        if (user?.role === 'Assessor' && user.name) {
          loaded.signOff.seenBy = user.name;
        }
        setFormData(loaded);
        setSerialNo(data.datasheet.serial_no);
        setStatus(data.datasheet.status);
        setAssignedToName(data.datasheet.assigned_to_name || null);
        setPermissions(data.permissions);
        setAudit(data.audit || []);
        setDelayNotes(normalizeDelayNotes(data.datasheet.delay_notes));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, [id, user?.name]);

  useEffect(() => {
    if (!canAssign) return;
    fetch('/api/users/assessors')
      .then((r) => r.json())
      .then((d) => setAssignees(d.assessors || []));
  }, [canAssign]);

  const handleSave = async (data: DatasheetFormData, newStatus: DatasheetStatus) => {
    const { ok, data: result } = await fetchJson<{
      message?: string;
      datasheet: { status: DatasheetStatus };
    }>(`/api/datasheets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formData: data, status: newStatus }),
    });
    if (!ok) throw new Error(result.message || 'Failed to save');
    setStatus(result.datasheet.status);
    reload();
  };

  const runAction = async (url: string, method: string, body?: Record<string, unknown>) => {
    setActionMessage('');
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) {
      setActionMessage(data.message || 'Action failed');
      return;
    }
    setActionMessage('Workflow updated');
    reload();
  };

  const isReadOnly = !permissions?.canEdit;

  if (loading) {
    return (
      <AuthGuard>
        <AppShell>
          <p className="text-sm text-slate-500">Loading task…</p>
        </AppShell>
      </AuthGuard>
    );
  }

  if (error || !formData) {
    return (
      <AuthGuard>
        <AppShell>
          <p className="text-sm text-red-600">{error || 'Task not found'}</p>
        </AppShell>
      </AuthGuard>
    );
  }

  const actions = permissions?.workflowActions || [];

  return (
    <AuthGuard>
      <AppShell>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={status} />
              {assignedToName && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  Allocated to {assignedToName}
                </span>
              )}
            </div>
            <PageHeader
              title={serialNo || 'Assessment task'}
              subtitle={STATUS_DESCRIPTIONS[status]}
            />
          </div>
        </div>

        <div className="section-card mb-6">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Workflow actions</h3>
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <button
                key={action.status}
                type="button"
                className={
                  action.variant === 'primary'
                    ? 'btn-primary'
                    : action.variant === 'danger'
                      ? 'btn-secondary text-red-700 hover:bg-red-50'
                      : 'btn-secondary'
                }
                onClick={() => {
                  if (action.status === 'queried') {
                    const reason = prompt('Query reason (required):');
                    if (!reason || reason.trim().length < 3) {
                      setActionMessage('Query reason is required (min 3 characters)');
                      return;
                    }
                    runAction(`/api/datasheets/${id}/review`, 'PATCH', {
                      status: action.status,
                      reason: reason.trim(),
                    });
                    return;
                  }
                  if (action.status === 'cancelled') {
                    const code = prompt(
                      'Cancellation code:\n' +
                        'instruction_withdrawn | duplicate_file | wrong_assessor_firm | vehicle_not_available | claim_repudiated | other',
                    );
                    if (!code) return;
                    let reason = '';
                    if (code.trim() === 'other') {
                      reason = prompt('Describe cancellation:') || '';
                      if (reason.trim().length < 3) {
                        setActionMessage('Please describe the cancellation reason');
                        return;
                      }
                    }
                    runAction(`/api/datasheets/${id}/review`, 'PATCH', {
                      status: action.status,
                      cancelReason: code.trim(),
                      reason,
                    });
                    return;
                  }
                  runAction(`/api/datasheets/${id}/review`, 'PATCH', { status: action.status });
                }}
              >
                Move to {action.label}
              </button>
            ))}
            {permissions?.canReopen && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const reason = prompt('Reason for reopening this file (required):');
                  if (!reason || reason.trim().length < 3) {
                    setActionMessage('Reopen reason is required (min 3 characters)');
                    return;
                  }
                  runAction(`/api/datasheets/${id}/reopen`, 'POST', { reason: reason.trim() });
                }}
              >
                Reopen as Queried
              </button>
            )}
            {permissions?.canDuplicate && (
              <button
                type="button"
                className="btn-secondary"
                onClick={async () => {
                  const res = await fetch(`/api/datasheets/${id}/duplicate`, { method: 'POST' });
                  const data = await res.json();
                  if (res.ok) router.push(`/datasheets/${data.datasheet.id}`);
                  else setActionMessage(data.message || 'Duplicate failed');
                }}
              >
                Duplicate task
              </button>
            )}
            {(permissions?.canAssign || canAssign) && (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={assignTo}
                  onChange={(e) => setAssignTo(e.target.value)}
                  className="form-input py-2 text-sm"
                >
                  <option value="">Allocate to Assessor / Principal Officer…</option>
                  {assignees.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.roleLabel || ROLE_LABELS[a.role]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!assignTo}
                  onClick={async () => {
                    const res = await fetch(`/api/datasheets/${id}/assign`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ assignedTo: Number(assignTo) }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      setActionMessage(data.message || 'Allocation failed');
                      return;
                    }
                    setActionMessage('Task allocated');
                    setAssignTo('');
                    reload();
                  }}
                >
                  <UserPlus className="h-4 w-4" />
                  Allocate
                </button>
              </div>
            )}
            {(permissions?.canDelete || canDelete) && (
              <button
                type="button"
                className="btn-secondary text-red-700 hover:bg-red-50"
                onClick={async () => {
                  if (
                    !confirm(
                      `Permanently delete ${serialNo || 'this task'}? This cannot be undone.`,
                    )
                  ) {
                    return;
                  }
                  const res = await fetch(`/api/datasheets/${id}`, { method: 'DELETE' });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    setActionMessage(data.message || 'Delete failed');
                    return;
                  }
                  router.push('/datasheets');
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete task
              </button>
            )}
            {actions.length === 0 &&
              !permissions?.canReopen &&
              !permissions?.canDuplicate &&
              !permissions?.canDelete &&
              !permissions?.canAssign && (
              <p className="text-sm text-slate-500">No workflow actions available for your role at this stage.</p>
            )}
          </div>
          {actionMessage && <p className="mt-3 text-sm text-emerald-600">{actionMessage}</p>}
        </div>

        <DelayNotesPanel
          datasheetId={id}
          notes={delayNotes}
          onUpdated={(notes) => {
            setDelayNotes(notes);
            setActionMessage('Delay note saved');
            reload();
          }}
        />

        {audit.length > 0 && (
          <div className="section-card mb-6">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Activity timeline</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              {audit.slice(0, 12).map((entry) => {
                const toLabel =
                  typeof entry.details?.label === 'string'
                    ? entry.details.label
                    : typeof entry.details?.to === 'string'
                      ? STATUS_LABELS[entry.details.to as DatasheetStatus] || entry.details.to
                      : null;
                const delaySnippet =
                  entry.action === 'delay_note' && typeof entry.details?.note === 'string'
                    ? entry.details.note
                    : null;
                return (
                  <li key={entry.id} className="flex flex-wrap gap-x-2 border-l-2 border-brand-200 pl-3">
                    <span className="font-medium text-slate-800">
                      {entry.action === 'status_changed' && toLabel
                        ? `Status → ${toLabel}`
                        : entry.action === 'delay_note'
                          ? 'Delay note added'
                          : entry.action}
                    </span>
                    <span>· {entry.user_name || 'System'}</span>
                    <span className="text-slate-400">· {new Date(entry.created_at).toLocaleString()}</span>
                    {delaySnippet && (
                      <span className="w-full text-xs text-amber-900/80">“{delaySnippet}”</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <DatasheetForm
          initialData={formData}
          datasheetId={id}
          serialNo={serialNo}
          status={status}
          readOnly={isReadOnly}
          onSave={handleSave}
        />
      </AppShell>
    </AuthGuard>
  );
}
