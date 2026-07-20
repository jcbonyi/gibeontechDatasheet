'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Plus,
  Search,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  canAssignDatasheet,
  canViewAllDatasheets,
} from '@/lib/permissions';
import { DATASHEET_STATUSES, ROLE_LABELS, type DatasheetStatus } from '@/types/datasheet';
import { SLA_DAYS, type AgeBand } from '@/lib/tracking';

interface DatasheetRow {
  id: number;
  serial_no: string;
  status: DatasheetStatus;
  claim_no: string | null;
  reg_no: string | null;
  created_by_name?: string | null;
  assigned_to_name?: string | null;
  created_at: string;
  updated_at: string;
  date_of_instruction: string | null;
  age_days: number | null;
  age_band: AgeBand;
  is_overdue: boolean;
  client_insurer: string | null;
}

interface AssessorOption {
  id: number;
  name: string;
}

type StatusFilter = '' | DatasheetStatus;

export function DatasheetRegister() {
  const { user } = useAuth();
  const [datasheets, setDatasheets] = useState<DatasheetRow[]>([]);
  const [assessors, setAssessors] = useState<AssessorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimNo, setClaimNo] = useState('');
  const [regNo, setRegNo] = useState('');
  const [assessorId, setAssessorId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [assignTo, setAssignTo] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const canAssign = user ? canAssignDatasheet(user) : false;
  const viewAll = user ? canViewAllDatasheets(user.role) : false;

  const filterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (claimNo) params.set('claimNo', claimNo);
    if (regNo) params.set('regNo', regNo);
    if (status) params.set('status', status);
    if (assessorId) params.set('assessorId', assessorId);
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    return params;
  }, [assessorId, claimNo, fromDate, regNo, status, toDate]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = filterParams();
    const res = await fetch(`/api/datasheets?${params}`);
    const data = await res.json();
    setDatasheets(data.datasheets || []);
    setLoading(false);
  }, [filterParams]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canAssign) return;
    fetch('/api/users/assessors')
      .then((r) => r.json())
      .then((d) => setAssessors(d.assessors || []));
  }, [canAssign]);

  const stats = useMemo(() => {
    const counts = Object.fromEntries(DATASHEET_STATUSES.map((s) => [s, 0])) as Record<
      DatasheetStatus,
      number
    >;
    let overdue = 0;
    datasheets.forEach((d) => {
      counts[d.status] += 1;
      if (d.is_overdue) overdue += 1;
    });
    return { total: datasheets.length, overdue, ...counts };
  }, [datasheets]);

  const visibleDatasheets = useMemo(() => {
    if (!status) return datasheets;
    return datasheets.filter((d) => d.status === status);
  }, [datasheets, status]);

  const handleAssign = async (id: number) => {
    if (!assignTo) return;
    const res = await fetch(`/api/datasheets/${id}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedTo: Number(assignTo) }),
    });
    const data = await res.json();
    if (!res.ok) {
      setActionMessage(data.message || 'Assignment failed');
      return;
    }
    setActionMessage('Datasheet assigned');
    setAssigningId(null);
    setAssignTo('');
    load();
  };

  const exportReport = (format: string, pack = 'register') => {
    const params = filterParams();
    params.set('format', format);
    params.set('pack', pack);
    window.location.href = `/api/reports/export?${params}`;
  };

  const statusClass = (value: DatasheetStatus) => {
    if (value === 'submitted') return 'status-submitted';
    if (value === 'under_review') return 'status-review';
    if (value === 'approved') return 'status-approved';
    return 'status-draft';
  };

  const statCards: {
    key: StatusFilter | 'overdue';
    label: string;
    value: number;
    valueClass: string;
    activeClass: string;
  }[] = [
    { key: '', label: 'Total', value: stats.total, valueClass: 'text-brand-700', activeClass: 'ring-2 ring-brand-500 border-brand-200 bg-brand-50/60' },
    { key: 'draft', label: 'Drafts', value: stats.draft, valueClass: 'text-amber-700', activeClass: 'ring-2 ring-amber-500 border-amber-200 bg-amber-50/60' },
    { key: 'submitted', label: 'Submitted', value: stats.submitted, valueClass: 'text-emerald-700', activeClass: 'ring-2 ring-emerald-500 border-emerald-200 bg-emerald-50/60' },
    { key: 'under_review', label: 'Under Review', value: stats.under_review, valueClass: 'text-sky-700', activeClass: 'ring-2 ring-sky-500 border-sky-200 bg-sky-50/60' },
    { key: 'approved', label: 'Approved', value: stats.approved, valueClass: 'text-violet-700', activeClass: 'ring-2 ring-violet-500 border-violet-200 bg-violet-50/60' },
  ];

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Datasheet Register</h1>
          <p className="page-subtitle">
            {viewAll
              ? 'All motor claim assessment datasheets · ageing from Date of Instruction'
              : `Your datasheets · ${ROLE_LABELS[user?.role || 'Assessor']}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => exportReport('csv')} className="btn-secondary">
            <Download className="h-4 w-4" />
            CSV
          </button>
          <button type="button" onClick={() => exportReport('xlsx', 'register')} className="btn-secondary">
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </button>
          <button type="button" onClick={() => exportReport('pdf', 'analytics-pdf')} className="btn-secondary">
            <FileText className="h-4 w-4" />
            PDF report
          </button>
          <Link href="/datasheets/new" className="btn-primary">
            <Plus className="h-4 w-4" />
            New Datasheet
          </Link>
        </div>
      </div>

      {stats.overdue > 0 && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>{stats.overdue}</strong> open datasheet{stats.overdue === 1 ? '' : 's'} overdue
          (more than {SLA_DAYS} days since Date of Instruction).
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map((card) => {
          const isActive = status === card.key;
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => setStatus(card.key === 'overdue' ? '' : (card.key as StatusFilter))}
              className={`section-card w-full py-4 text-left transition hover:shadow-md ${
                isActive ? card.activeClass : 'hover:border-slate-300'
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
              <p className={`mt-1 text-2xl font-bold ${card.valueClass}`}>{card.value}</p>
            </button>
          );
        })}
      </div>

      <div className="section-card mb-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input value={claimNo} onChange={(e) => setClaimNo(e.target.value)} placeholder="Claim No." className="form-input" />
          <input value={regNo} onChange={(e) => setRegNo(e.target.value)} placeholder="Reg. No." className="form-input" />
          {viewAll && (
            <select value={assessorId} onChange={(e) => setAssessorId(e.target.value)} className="form-input">
              <option value="">All assessors</option>
              {assessors.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}
          <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="form-input">
            <option value="">All statuses</option>
            {DATASHEET_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="form-input" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="form-input" />
          <button type="button" onClick={load} className="btn-secondary sm:col-span-2">
            <Search className="h-4 w-4" />
            Search
          </button>
        </div>
        {actionMessage && <p className="mt-3 text-sm text-emerald-600">{actionMessage}</p>}
      </div>

      <div className="section-card overflow-x-auto">
        {loading ? (
          <p className="text-sm text-slate-500">Loading datasheets…</p>
        ) : visibleDatasheets.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No datasheets found.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Serial</th>
                <th>Claim No.</th>
                <th>Reg. No.</th>
                <th>Status</th>
                <th>Instruction</th>
                <th>Age</th>
                {viewAll && <th>Assessor</th>}
                {viewAll && <th>Assigned To</th>}
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleDatasheets.map((row) => (
                <tr key={row.id} className={row.is_overdue ? 'bg-red-50/40' : undefined}>
                  <td className="font-semibold text-brand-800">{row.serial_no}</td>
                  <td>{row.claim_no || '—'}</td>
                  <td>{row.reg_no || '—'}</td>
                  <td>
                    <span className={`status-badge ${statusClass(row.status)}`}>
                      {row.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="text-slate-600">{row.date_of_instruction || '—'}</td>
                  <td>
                    {row.age_days != null ? (
                      <span className={row.is_overdue ? 'font-semibold text-red-700' : 'text-slate-700'}>
                        {row.age_days}d
                        {row.is_overdue ? ' · overdue' : ''}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  {viewAll && <td>{row.created_by_name || '—'}</td>}
                  {viewAll && <td>{row.assigned_to_name || '—'}</td>}
                  <td className="text-slate-500">{new Date(row.updated_at).toLocaleString()}</td>
                  <td>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/datasheets/${row.id}`} className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-800">
                        <FileText className="h-4 w-4" />
                        Open
                      </Link>
                      {canAssign && (
                        assigningId === row.id ? (
                          <div className="flex items-center gap-1">
                            <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="form-input py-1 text-xs">
                              <option value="">Select assessor</option>
                              {assessors.map((a) => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                              ))}
                            </select>
                            <button type="button" onClick={() => handleAssign(row.id)} className="btn-secondary px-2 py-1 text-xs">Save</button>
                            <button type="button" onClick={() => setAssigningId(null)} className="text-xs text-slate-500">Cancel</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setAssigningId(row.id)} className="inline-flex items-center gap-1 text-xs font-medium text-accent-700 hover:text-accent-900">
                            <UserPlus className="h-3.5 w-3.5" />
                            Assign
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
