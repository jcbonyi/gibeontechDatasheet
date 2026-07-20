'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { DatasheetForm } from '@/components/DatasheetForm';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { DatasheetFormData, mergeFormData, type DatasheetStatus } from '@/types/datasheet';
import { STATUS_DESCRIPTIONS, STATUS_LABELS } from '@/lib/status';
import { useAuth } from '@/context/AuthContext';
import { fetchJson } from '@/lib/fetchJson';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const reload = () => {
    fetchJson<{
      message?: string;
      datasheet: {
        form_data: DatasheetFormData;
        serial_no: string;
        status: DatasheetStatus;
        assigned_to_name?: string | null;
      };
      permissions: DatasheetPermissions;
      audit: AuditEntry[];
    }>(`/api/datasheets/${id}`)
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.message || 'Failed to load');
        const loaded = mergeFormData(data.datasheet.form_data as DatasheetFormData);
        if (user?.name) loaded.signOff.seenBy = user.name;
        setFormData(loaded);
        setSerialNo(data.datasheet.serial_no);
        setStatus(data.datasheet.status);
        setAssignedToName(data.datasheet.assigned_to_name || null);
        setPermissions(data.permissions);
        setAudit(data.audit || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, [id, user?.name]);

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
                onClick={() =>
                  runAction(`/api/datasheets/${id}/review`, 'PATCH', { status: action.status })
                }
              >
                Move to {action.label}
              </button>
            ))}
            {permissions?.canReopen && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const reason = prompt('Reason for reopening this file:');
                  if (reason) runAction(`/api/datasheets/${id}/reopen`, 'POST', { reason });
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
            {actions.length === 0 && !permissions?.canReopen && !permissions?.canDuplicate && (
              <p className="text-sm text-slate-500">No workflow actions available for your role at this stage.</p>
            )}
          </div>
          {actionMessage && <p className="mt-3 text-sm text-emerald-600">{actionMessage}</p>}
        </div>

        {audit.length > 0 && (
          <div className="section-card mb-6">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Activity timeline</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              {audit.slice(0, 10).map((entry) => {
                const toLabel =
                  typeof entry.details?.label === 'string'
                    ? entry.details.label
                    : typeof entry.details?.to === 'string'
                      ? STATUS_LABELS[entry.details.to as DatasheetStatus] || entry.details.to
                      : null;
                return (
                  <li key={entry.id} className="flex flex-wrap gap-x-2 border-l-2 border-brand-200 pl-3">
                    <span className="font-medium text-slate-800">
                      {entry.action === 'status_changed' && toLabel
                        ? `Status → ${toLabel}`
                        : entry.action}
                    </span>
                    <span>· {entry.user_name || 'System'}</span>
                    <span className="text-slate-400">· {new Date(entry.created_at).toLocaleString()}</span>
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
