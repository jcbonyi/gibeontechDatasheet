'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { DatasheetForm } from '@/components/DatasheetForm';
import { PageHeader } from '@/components/PageHeader';
import { DatasheetFormData, mergeFormData, type DatasheetStatus } from '@/types/datasheet';
import { useAuth } from '@/context/AuthContext';

interface DatasheetPermissions {
  canEdit: boolean;
  canAssign: boolean;
  canReopen: boolean;
  canMarkUnderReview: boolean;
  canApprove: boolean;
  canDuplicate: boolean;
  canDelete: boolean;
}

interface AuditEntry {
  id: number;
  action: string;
  user_name: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

import { fetchJson } from '@/lib/fetchJson';

export default function EditDatasheetPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = Number(params.id);
  const [formData, setFormData] = useState<DatasheetFormData | null>(null);
  const [serialNo, setSerialNo] = useState('');
  const [status, setStatus] = useState<DatasheetStatus>('draft');
  const [assignedToName, setAssignedToName] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<DatasheetPermissions | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const reload = () => {
    fetchJson<{
      message?: string;
      datasheet: { form_data: DatasheetFormData; serial_no: string; status: DatasheetStatus; assigned_to_name?: string | null };
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
    const { ok, data: result } = await fetchJson<{ message?: string; datasheet: { status: DatasheetStatus } }>(
      `/api/datasheets/${id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formData: data, status: newStatus }),
      },
    );
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
    setActionMessage('Action completed');
    reload();
  };

  const isReadOnly = !permissions?.canEdit;

  if (loading) {
    return (
      <AuthGuard>
        <AppShell>
          <p className="text-sm text-slate-500">Loading datasheet...</p>
        </AppShell>
      </AuthGuard>
    );
  }

  if (error || !formData) {
    return (
      <AuthGuard>
        <AppShell>
          <p className="text-sm text-red-600">{error || 'Datasheet not found'}</p>
        </AppShell>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <AppShell>
        <PageHeader
          title={serialNo || 'Datasheet'}
          subtitle={`Status: ${status.replace('_', ' ')}${assignedToName ? ` · Assigned to ${assignedToName}` : ''}`}
        />

        {(permissions?.canReopen || permissions?.canMarkUnderReview || permissions?.canApprove || permissions?.canDuplicate) && (
          <div className="section-card mb-6 flex flex-wrap gap-2">
            {permissions.canMarkUnderReview && (
              <button type="button" className="btn-secondary" onClick={() => runAction(`/api/datasheets/${id}/review`, 'PATCH', { action: 'under_review' })}>
                Mark Under Review
              </button>
            )}
            {permissions.canApprove && (
              <button type="button" className="btn-secondary" onClick={() => runAction(`/api/datasheets/${id}/review`, 'PATCH', { action: 'approve' })}>
                Approve
              </button>
            )}
            {permissions.canReopen && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const reason = prompt('Reason for reopening:');
                  if (reason) runAction(`/api/datasheets/${id}/reopen`, 'POST', { reason });
                }}
              >
                Reopen as Draft
              </button>
            )}
            {permissions.canDuplicate && (
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
                Duplicate
              </button>
            )}
            {actionMessage && <p className="w-full text-sm text-emerald-600">{actionMessage}</p>}
          </div>
        )}

        {audit.length > 0 && (
          <div className="section-card mb-6">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Audit Trail</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              {audit.slice(0, 8).map((entry) => (
                <li key={entry.id}>
                  <span className="font-medium text-slate-800">{entry.action}</span>
                  {' · '}
                  {entry.user_name || 'System'}
                  {' · '}
                  {new Date(entry.created_at).toLocaleString()}
                </li>
              ))}
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
