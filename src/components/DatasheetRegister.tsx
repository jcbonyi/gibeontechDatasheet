'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Columns3,
  Download,
  FileSpreadsheet,
  FileText,
  List,
  Plus,
  Search,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { canAssignDatasheet, canViewAllDatasheets } from '@/lib/permissions';
import { ROLE_LABELS, type DatasheetStatus } from '@/types/datasheet';
import {
  BOARD_STATUSES,
  DATASHEET_STATUSES,
  isOpenStatus,
  STATUS_LABELS,
} from '@/lib/status';
import type { AgeBand } from '@/lib/tracking';
import { StatusBadge } from '@/components/StatusBadge';

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
  form_types: string[];
}

interface AssessorOption {
  id: number;
  name: string;
}

type StatusFilter = '' | DatasheetStatus;
type ViewMode = 'board' | 'list';

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
  const [view, setView] = useState<ViewMode>('board');
  const [openOnly, setOpenOnly] = useState(true);
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

  const filtered = useMemo(() => {
    let rows = datasheets;
    if (status) rows = rows.filter((d) => d.status === status);
    if (openOnly) rows = rows.filter((d) => isOpenStatus(d.status));
    return rows;
  }, [datasheets, openOnly, status]);

  const stats = useMemo(() => {
    const counts = Object.fromEntries(DATASHEET_STATUSES.map((s) => [s, 0])) as Record<
      DatasheetStatus,
      number
    >;
    let overdue = 0;
    let open = 0;
    datasheets.forEach((d) => {
      counts[d.status] = (counts[d.status] || 0) + 1;
      if (d.is_overdue) overdue += 1;
      if (isOpenStatus(d.status)) open += 1;
    });
    return { total: datasheets.length, overdue, open, counts };
  }, [datasheets]);

  const boardColumns = useMemo(
    () =>
      BOARD_STATUSES.map((col) => ({
        status: col,
        label: STATUS_LABELS[col],
        items: filtered.filter((d) => d.status === col),
      })),
    [filtered],
  );

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
    setActionMessage('Task allocated to assessor');
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

  const pipelineCards: {
    key: StatusFilter | 'open';
    label: string;
    value: number;
    valueClass: string;
  }[] = [
    { key: 'open', label: 'Open tasks', value: stats.open, valueClass: 'text-brand-700' },
    {
      key: 'instructed',
      label: 'Instructed',
      value: stats.counts.instructed || 0,
      valueClass: 'text-slate-700',
    },
    {
      key: 'in_progress',
      label: 'In progress',
      value: stats.counts.in_progress || 0,
      valueClass: 'text-sky-700',
    },
    {
      key: 'pending_review',
      label: 'Pending review',
      value: stats.counts.pending_review || 0,
      valueClass: 'text-amber-700',
    },
    { key: 'open', label: 'Overdue', value: stats.overdue, valueClass: 'text-red-700' },
  ];

  // Deduplicate open key for overdue card - use separate handling
  const cards = [
    pipelineCards[0],
    pipelineCards[1],
    pipelineCards[2],
    pipelineCards[3],
    { key: 'overdue' as const, label: 'Overdue', value: stats.overdue, valueClass: 'text-red-700' },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Assessment tasks</h1>
          <p className="page-subtitle">
            {viewAll
              ? 'Track motor assessments, inspections, re-inspections & reports'
              : `Your allocated work · ${ROLE_LABELS[user?.role || 'Assessor']}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setView('board')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                view === 'board' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Columns3 className="h-4 w-4" />
              Board
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                view === 'list' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <List className="h-4 w-4" />
              List
            </button>
          </div>
          <button type="button" onClick={() => exportReport('xlsx', 'register')} className="btn-secondary">
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </button>
          <button type="button" onClick={() => exportReport('pdf', 'analytics-pdf')} className="btn-secondary">
            <FileText className="h-4 w-4" />
            PDF
          </button>
          <button type="button" onClick={() => exportReport('csv')} className="btn-secondary">
            <Download className="h-4 w-4" />
            CSV
          </button>
          <Link href="/datasheets/new" className="btn-primary">
            <Plus className="h-4 w-4" />
            New instruction
          </Link>
        </div>
      </div>

      {stats.overdue > 0 && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>{stats.overdue}</strong> open task{stats.overdue === 1 ? '' : 's'} overdue
          (more than 7 days since Date of Instruction).
        </div>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => {
          const isActive =
            (card.key === 'open' && openOnly && !status) ||
            (card.key !== 'open' && card.key !== 'overdue' && status === card.key);
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => {
                if (card.key === 'open' || card.key === 'overdue') {
                  setOpenOnly(true);
                  setStatus('');
                } else {
                  setOpenOnly(false);
                  setStatus(card.key);
                }
              }}
              className={`section-card w-full py-3.5 text-left transition hover:shadow-md ${
                isActive ? 'ring-2 ring-brand-500 border-brand-200 bg-brand-50/50' : ''
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
              <p className={`mt-0.5 text-2xl font-bold ${card.valueClass}`}>{card.value}</p>
            </button>
          );
        })}
      </div>

      <div className="section-card mb-5">
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
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as StatusFilter);
              setOpenOnly(false);
            }}
            className="form-input"
          >
            <option value="">All statuses</option>
            {DATASHEET_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="form-input" title="From" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="form-input" title="To" />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={openOnly}
              onChange={(e) => {
                setOpenOnly(e.target.checked);
                if (e.target.checked) setStatus('');
              }}
              className="rounded border-slate-300 text-brand-600"
            />
            Open tasks only
          </label>
          <button type="button" onClick={load} className="btn-secondary">
            <Search className="h-4 w-4" />
            Search
          </button>
        </div>
        {actionMessage && <p className="mt-3 text-sm text-emerald-600">{actionMessage}</p>}
      </div>

      {loading ? (
        <div className="section-card text-sm text-slate-500">Loading tasks…</div>
      ) : view === 'board' ? (
        <div className="task-board -mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          <div className="flex min-w-max gap-3">
            {boardColumns.map((col) => (
              <div key={col.status} className="task-column">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">{col.label}</h3>
                  <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                    {col.items.length}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {col.items.length === 0 && (
                    <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
                      No tasks
                    </p>
                  )}
                  {col.items.map((row) => (
                    <Link
                      key={row.id}
                      href={`/datasheets/${row.id}`}
                      className={`task-card block ${row.is_overdue ? 'task-card-overdue' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-brand-800">{row.serial_no}</p>
                        {row.age_days != null && (
                          <span className={`text-[11px] font-semibold ${row.is_overdue ? 'text-red-600' : 'text-slate-500'}`}>
                            {row.age_days}d
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm text-slate-700">
                        {row.claim_no || 'No claim no.'} · {row.reg_no || '—'}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {row.client_insurer || 'No insurer'}
                      </p>
                      {row.form_types?.length > 0 && (
                        <p className="mt-1.5 truncate text-[10px] font-medium uppercase tracking-wide text-slate-400">
                          {row.form_types.join(' · ')}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-slate-500">
                        {row.assigned_to_name || row.created_by_name || 'Unassigned'}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="section-card overflow-x-auto">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No tasks found.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Serial</th>
                  <th>Claim</th>
                  <th>Reg.</th>
                  <th>Status</th>
                  <th>Instruction</th>
                  <th>Age</th>
                  {viewAll && <th>Assessor</th>}
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className={row.is_overdue ? 'bg-red-50/40' : undefined}>
                    <td className="font-semibold text-brand-800">{row.serial_no}</td>
                    <td>{row.claim_no || '—'}</td>
                    <td>{row.reg_no || '—'}</td>
                    <td><StatusBadge status={row.status} /></td>
                    <td className="text-slate-600">{row.date_of_instruction || '—'}</td>
                    <td>
                      {row.age_days != null ? (
                        <span className={row.is_overdue ? 'font-semibold text-red-700' : ''}>
                          {row.age_days}d{row.is_overdue ? ' · overdue' : ''}
                        </span>
                      ) : '—'}
                    </td>
                    {viewAll && <td>{row.assigned_to_name || row.created_by_name || '—'}</td>}
                    <td className="text-slate-500">{new Date(row.updated_at).toLocaleString()}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/datasheets/${row.id}`} className="font-medium text-brand-600 hover:text-brand-800">
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
                            <button type="button" onClick={() => setAssigningId(row.id)} className="inline-flex items-center gap-1 text-xs font-medium text-accent-700">
                              <UserPlus className="h-3.5 w-3.5" />
                              Allocate
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
      )}
    </div>
  );
}
