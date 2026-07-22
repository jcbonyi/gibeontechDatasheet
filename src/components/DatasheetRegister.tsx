'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Ban,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  FileSpreadsheet,
  FileText,
  Inbox,
  List,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { canAssignDatasheet, canDeleteDatasheet, canViewAllDatasheets } from '@/lib/permissions';
import { ROLE_LABELS, type DatasheetStatus, type UserRole } from '@/types/datasheet';
import {
  BOARD_STATUSES,
  DATASHEET_STATUSES,
  isOpenStatus,
  STATUS_LABELS,
} from '@/lib/status';
import type { AgeBand } from '@/lib/tracking';
import { SLA_DAYS } from '@/lib/tracking';
import { CANCEL_REASONS, SAVED_VIEWS, type SavedViewId } from '@/lib/opsConfig';
import { StatusBadge } from '@/components/StatusBadge';

interface DatasheetRow {
  id: number;
  serial_no: string;
  status: DatasheetStatus;
  claim_no: string | null;
  reg_no: string | null;
  created_by: number | null;
  assigned_to: number | null;
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
  role?: UserRole;
  roleLabel?: string;
}

type StatusFilter = '' | DatasheetStatus;
type ViewMode = 'board' | 'list';
type SavedView = (typeof SAVED_VIEWS)[number];
type ScopeFilter = '' | 'mine' | 'unallocated' | 'overdue' | 'all';

const PIPELINE_STEPS: { status: DatasheetStatus; label: string }[] = [
  { status: 'instructed', label: 'Instructed' },
  { status: 'allocated', label: 'Allocated' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'report_issued', label: 'Report Issued' },
];

function pillClass(active: boolean): string {
  return `nav-pill ${active ? 'nav-pill-active' : 'nav-pill-idle bg-white border border-slate-200'}`;
}

export function DatasheetRegister() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [datasheets, setDatasheets] = useState<DatasheetRow[]>([]);
  const [assessors, setAssessors] = useState<AssessorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [claimNo, setClaimNo] = useState('');
  const [regNo, setRegNo] = useState('');
  const [assessorId, setAssessorId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const initialStatus = searchParams.get('status') || '';
  const initialUnallocated = searchParams.get('unallocated') === '1';
  const [status, setStatus] = useState<StatusFilter>(
    DATASHEET_STATUSES.includes(initialStatus as DatasheetStatus)
      ? (initialStatus as DatasheetStatus)
      : '',
  );
  const [scope, setScope] = useState<ScopeFilter>(initialUnallocated ? 'unallocated' : '');
  const [selectedView, setSelectedView] = useState<SavedViewId | ''>('');
  const [view, setView] = useState<ViewMode>('board');
  const [openOnly, setOpenOnly] = useState(!initialStatus && !initialUnallocated);
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [assignTo, setAssignTo] = useState('');
  const [inlineAssign, setInlineAssign] = useState<Record<number, string>>({});
  const [actionMessage, setActionMessage] = useState('');
  const [dragOverTarget, setDragOverTarget] = useState<string>('');
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const boardScrollRef = useRef<HTMLDivElement>(null);

  const canAssign = user ? canAssignDatasheet(user) : false;
  const canDelete = user ? canDeleteDatasheet(user) : false;
  const viewAll = user ? canViewAllDatasheets(user.role) : false;
  const isAdmin = user?.role === 'Admin';

  const filterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (claimNo) params.set('claimNo', claimNo);
    if (regNo) params.set('regNo', regNo);
    if (status) params.set('status', status);
    if (assessorId) params.set('assessorId', assessorId);
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    if (scope === 'unallocated') params.set('unallocated', '1');
    return params;
  }, [assessorId, claimNo, fromDate, q, regNo, scope, status, toDate]);

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

  const clearSelectedView = () => setSelectedView('');

  const applySavedView = (savedView: SavedView) => {
    setSelectedView(savedView.id);
    setOpenOnly(savedView.openOnly);
    setStatus('status' in savedView && savedView.status ? savedView.status : '');
    setScope('scope' in savedView && savedView.scope ? savedView.scope : '');
  };

  const resetFilters = () => {
    setQ('');
    setClaimNo('');
    setRegNo('');
    setAssessorId('');
    setFromDate('');
    setToDate('');
    setStatus('');
    setScope('');
    setSelectedView('');
    setOpenOnly(true);
  };

  const filtered = useMemo(() => {
    let rows = datasheets;
    if (status) rows = rows.filter((d) => d.status === status);
    if (scope === 'mine' && user) {
      rows = rows.filter((d) => d.assigned_to === user.id || d.created_by === user.id);
    }
    if (scope === 'overdue') {
      rows = rows.filter((d) => d.is_overdue);
    }
    if (openOnly) rows = rows.filter((d) => isOpenStatus(d.status));
    return rows;
  }, [datasheets, openOnly, scope, status, user]);

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
      })).filter((col) => col.items.length > 0),
    [filtered],
  );

  const updateBoardScrollState = useCallback(() => {
    const el = boardScrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(max > 4 && el.scrollLeft < max - 4);
  }, []);

  useEffect(() => {
    if (view !== 'board') return;
    const el = boardScrollRef.current;
    if (!el) return;
    updateBoardScrollState();
    el.addEventListener('scroll', updateBoardScrollState, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateBoardScrollState) : null;
    ro?.observe(el);
    window.addEventListener('resize', updateBoardScrollState);
    return () => {
      el.removeEventListener('scroll', updateBoardScrollState);
      ro?.disconnect();
      window.removeEventListener('resize', updateBoardScrollState);
    };
  }, [view, boardColumns, updateBoardScrollState]);

  const scrollBoard = (dir: -1 | 1) => {
    const el = boardScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(320, el.clientWidth * 0.7), behavior: 'smooth' });
  };

  const handleAssign = async (id: number, assignedTo: string) => {
    if (!assignedTo) return;
    const res = await fetch(`/api/datasheets/${id}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedTo: Number(assignedTo) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActionMessage(data.message || 'Assignment failed');
      return;
    }
    setActionMessage('Task allocated');
    setAssigningId(null);
    setAssignTo('');
    setInlineAssign((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    load();
  };

  const handleDelete = async (id: number, serial: string) => {
    if (!confirm(`Permanently delete ${serial}? This cannot be undone.`)) return;
    const res = await fetch(`/api/datasheets/${id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setActionMessage((data as { message?: string }).message || 'Delete failed');
      return;
    }
    setActionMessage(`Deleted ${serial}`);
    load();
  };

  const assigneeOptionLabel = (a: AssessorOption) =>
    `${a.name} · ${a.roleLabel || (a.role ? ROLE_LABELS[a.role] : 'Assignee')}`;

  const canAllocateRow = (status: DatasheetStatus) =>
    canAssign && (isAdmin || isOpenStatus(status));

  const handleDrop = async (targetStatus: DatasheetStatus, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverTarget('');
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;

    let payload: { id: number; status: DatasheetStatus };
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    const { id, status: fromStatus } = payload;
    if (!id || fromStatus === targetStatus) return;

    let reason = '';
    let cancelReason = '';

    if (targetStatus === 'queried') {
      const input = window.prompt(
        `Why is "${STATUS_LABELS[fromStatus]}" being queried? (minimum 3 characters)`,
      );
      if (input === null) return;
      if (input.trim().length < 3) {
        alert('A query reason of at least 3 characters is required.');
        return;
      }
      reason = input.trim();
    }

    if (targetStatus === 'cancelled') {
      const optionsList = CANCEL_REASONS.map((r) => `${r.value} — ${r.label}`).join('\n');
      const codeInput = window.prompt(
        `Select a cancellation reason. Type one of the following codes exactly:\n\n${optionsList}`,
      );
      if (codeInput === null) return;
      const code = codeInput.trim();
      if (!CANCEL_REASONS.some((r) => r.value === code)) {
        alert('That is not a valid cancellation reason code. Please try again.');
        return;
      }
      cancelReason = code;
      if (code === 'other') {
        const notes = window.prompt('Please describe the cancellation reason (minimum 3 characters):');
        if (notes === null || notes.trim().length < 3) {
          alert('A description of at least 3 characters is required when selecting "Other".');
          return;
        }
        reason = notes.trim();
      }
    }

    const res = await fetch(`/api/datasheets/${id}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: targetStatus, reason, cancelReason }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message =
        data.message ||
        (res.status === 403
          ? 'You do not have permission to move this task to that status.'
          : 'Failed to update the task status.');
      alert(message);
      window.location.reload();
      return;
    }

    setActionMessage(`Task moved to ${STATUS_LABELS[targetStatus]}`);
    load();
  };

  const handleDragStart = (row: DatasheetRow, e: React.DragEvent) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ id: row.id, status: row.status }),
    );
    e.dataTransfer.effectAllowed = 'move';
  };

  const exportReport = (format: string, pack = 'register') => {
    const params = filterParams();
    params.set('format', format);
    params.set('pack', pack);
    window.location.href = `/api/reports/export?${params}`;
  };

  const hasAnyTasks = datasheets.length > 0;

  const renderCard = (row: DatasheetRow) => {
    const inlineValue = inlineAssign[row.id] || '';
    return (
      <div
        key={row.id}
        draggable
        onDragStart={(e) => handleDragStart(row, e)}
        onClick={() => router.push(`/datasheets/${row.id}`)}
        role="button"
        tabIndex={0}
        data-shortcut="task-card"
        className={`task-card cursor-pointer ${row.is_overdue ? 'task-card-overdue' : ''}`}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-brand-800">{row.serial_no}</p>
          {row.age_days != null && (
            <span
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                row.age_days > SLA_DAYS ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {row.age_days}d
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-sm text-slate-700">
          {row.claim_no || 'No claim no.'} · {row.reg_no || '—'}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500">{row.client_insurer || 'No insurer'}</p>
        {row.form_types?.length > 0 && (
          <p className="mt-1.5 truncate text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {row.form_types.join(' · ')}
          </p>
        )}
        <p className="mt-1.5 text-xs text-slate-500">
          DOI: {row.date_of_instruction || '—'}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {row.assigned_to_name || row.created_by_name || 'Unassigned'}
        </p>
        {canAllocateRow(row.status) && (
          <div
            className="mt-2 flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onDragStart={(e) => e.stopPropagation()}
          >
            <select
              value={inlineValue}
              onChange={(e) =>
                setInlineAssign((prev) => ({ ...prev, [row.id]: e.target.value }))
              }
              className="form-input py-1 text-[11px]"
              data-shortcut="inline-allocate-select"
            >
              <option value="">Allocate to…</option>
              {assessors.map((a) => (
                <option key={a.id} value={a.id}>
                  {assigneeOptionLabel(a)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleAssign(row.id, inlineValue)}
              disabled={!inlineValue}
              className="inline-flex items-center gap-1 rounded-lg bg-accent-600 px-2 py-1 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              data-shortcut="inline-allocate-save"
            >
              <UserPlus className="h-3 w-3" />
              Go
            </button>
          </div>
        )}
        {canDelete && (
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-red-600 hover:text-red-800"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDelete(row.id, row.serial_no);
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
        )}
      </div>
    );
  };

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
              data-shortcut="view-board"
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
              data-shortcut="view-list"
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                view === 'list' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <List className="h-4 w-4" />
              List
            </button>
          </div>
          <button
            type="button"
            onClick={() => exportReport('xlsx', 'register')}
            className="btn-secondary"
            data-shortcut="export-excel"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </button>
          <button
            type="button"
            onClick={() => exportReport('pdf', 'analytics-pdf')}
            className="btn-secondary"
            data-shortcut="export-pdf"
          >
            <FileText className="h-4 w-4" />
            PDF
          </button>
          <button
            type="button"
            onClick={() => exportReport('csv')}
            className="btn-secondary"
            data-shortcut="export-csv"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
          <Link href="/datasheets/new" className="btn-primary" data-shortcut="new-instruction">
            <Plus className="h-4 w-4" />
            New instruction
          </Link>
        </div>
      </div>

      {stats.overdue > 0 && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>{stats.overdue}</strong> open task{stats.overdue === 1 ? '' : 's'} overdue
          (more than {SLA_DAYS} days since Date of Instruction).
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {SAVED_VIEWS.map((savedView) => (
          <button
            key={savedView.id}
            type="button"
            onClick={() => applySavedView(savedView)}
            data-shortcut={`saved-view-${savedView.id}`}
            className={pillClass(selectedView === savedView.id)}
          >
            {savedView.label}
          </button>
        ))}
        {(selectedView || status || scope || claimNo || regNo || assessorId || fromDate || toDate || q) && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      <div className="section-card mb-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                clearSelectedView();
              }}
              placeholder="Search serial, claim, reg, insurer…"
              className="form-input pl-9"
              data-shortcut="search-input"
            />
          </div>
          <input
            value={claimNo}
            onChange={(e) => {
              setClaimNo(e.target.value);
              clearSelectedView();
            }}
            placeholder="Claim No."
            className="form-input"
          />
          <input
            value={regNo}
            onChange={(e) => {
              setRegNo(e.target.value);
              clearSelectedView();
            }}
            placeholder="Reg. No."
            className="form-input"
          />
          {viewAll && (
            <select
              value={assessorId}
              onChange={(e) => {
                setAssessorId(e.target.value);
                clearSelectedView();
              }}
              className="form-input"
            >
              <option value="">All assignees</option>
              {assessors.map((a) => (
                <option key={a.id} value={a.id}>
                  {assigneeOptionLabel(a)}
                </option>
              ))}
            </select>
          )}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as StatusFilter);
              setOpenOnly(false);
              setScope('');
              clearSelectedView();
            }}
            className="form-input"
          >
            <option value="">All statuses</option>
            {DATASHEET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              clearSelectedView();
            }}
            className="form-input"
            title="From"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              clearSelectedView();
            }}
            className="form-input"
            title="To"
          />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={openOnly}
              onChange={(e) => {
                setOpenOnly(e.target.checked);
                if (e.target.checked) setStatus('');
                clearSelectedView();
              }}
              className="rounded border-slate-300 text-brand-600"
              data-shortcut="toggle-open-only"
            />
            Open tasks only
          </label>
          <button type="button" onClick={load} className="btn-secondary" data-shortcut="search-submit">
            <Search className="h-4 w-4" />
            Search
          </button>
        </div>
        {actionMessage && <p className="mt-3 text-sm text-emerald-600">{actionMessage}</p>}
      </div>

      {loading ? (
        <div className="section-card text-sm text-slate-500">Loading tasks…</div>
      ) : !hasAnyTasks ? (
        <div className="section-card">
          <div className="mx-auto max-w-2xl py-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
              <Inbox className="h-7 w-7 text-brand-500" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900">No assessment tasks yet</h2>
            <p className="mt-2 text-sm text-slate-500">
              Once a claim is instructed, it moves through a simple pipeline until the report is
              issued to the client. Create your first instruction to get started.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-slate-500">
              {PIPELINE_STEPS.map((step, i) => (
                <span key={step.status} className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">
                    {step.label}
                  </span>
                  {i < PIPELINE_STEPS.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-slate-300" />}
                </span>
              ))}
            </div>
            <Link href="/datasheets/new" className="btn-primary mt-6 inline-flex" data-shortcut="empty-new-instruction">
              <Plus className="h-4 w-4" />
              Create your first instruction
            </Link>
          </div>
        </div>
      ) : view === 'board' ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
            <p className="text-xs text-slate-500">
              <span className="font-semibold text-slate-700">
                {boardColumns.length} status column{boardColumns.length === 1 ? '' : 's'}
              </span>
              {' · '}
              empty stages are hidden
              {canScrollRight ? ' · scroll for more' : ''}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => scrollBoard(-1)}
                disabled={!canScrollLeft}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Scroll board left"
                title="Previous columns"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollBoard(1)}
                disabled={!canScrollRight}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Scroll board right"
                title="Next columns"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {canScrollRight && (
                <span className="hidden items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 sm:inline-flex">
                  More statuses
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
          </div>

          <div ref={boardScrollRef} className="task-board" data-shortcut="task-board">
            {boardColumns.length === 0 ? (
              <div className="flex min-h-[12rem] items-center justify-center p-6 text-center">
                <p className="text-sm text-slate-500">No open tasks in any stage for this filter.</p>
              </div>
            ) : (
            <div className="task-board-track">
              {boardColumns.map((col) => (
                <div
                  key={col.status}
                  data-shortcut="board-column"
                  data-status={col.status}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverTarget(col.status);
                  }}
                  onDragLeave={() => setDragOverTarget((cur) => (cur === col.status ? '' : cur))}
                  onDrop={(e) => handleDrop(col.status, e)}
                  className={`task-column ${
                    dragOverTarget === col.status ? 'ring-2 ring-brand-400 bg-brand-50/60' : ''
                  }`}
                >
                  <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
                      {col.label}
                    </h3>
                    <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      {col.items.length}
                    </span>
                  </div>
                  <div className="task-column-body">
                    {col.items.map((row) => renderCard(row))}
                  </div>
                </div>
              ))}

              <div
                data-shortcut="cancel-drop-zone"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverTarget('cancelled');
                }}
                onDragLeave={() => setDragOverTarget((cur) => (cur === 'cancelled' ? '' : cur))}
                onDrop={(e) => handleDrop('cancelled', e)}
                className={`task-column flex w-40 shrink-0 flex-col items-center justify-center border-2 border-dashed text-center ${
                  dragOverTarget === 'cancelled'
                    ? 'border-red-400 bg-red-50 ring-2 ring-red-300'
                    : 'border-slate-300 bg-slate-50/60'
                }`}
              >
                <Ban className="h-6 w-6 text-red-400" />
                <p className="mt-2 text-xs font-semibold text-slate-500">Drop here to cancel</p>
                <p className="mt-1 text-[11px] text-slate-400">Requires a cancellation reason</p>
              </div>
            </div>
            )}
          </div>
        </div>
      ) : (
        <div className="section-card overflow-x-auto">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No tasks match your filters.</p>
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
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="text-slate-600">{row.date_of_instruction || '—'}</td>
                    <td>
                      {row.age_days != null ? (
                        <span className={row.is_overdue ? 'font-semibold text-red-700' : ''}>
                          {row.age_days}d{row.is_overdue ? ' · overdue' : ''}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    {viewAll && <td>{row.assigned_to_name || row.created_by_name || '—'}</td>}
                    <td className="text-slate-500">{new Date(row.updated_at).toLocaleString()}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/datasheets/${row.id}`}
                          className="font-medium text-brand-600 hover:text-brand-800"
                        >
                          Open
                        </Link>
                        {canAllocateRow(row.status) &&
                          (assigningId === row.id ? (
                            <div className="flex items-center gap-1">
                              <select
                                value={assignTo}
                                onChange={(e) => setAssignTo(e.target.value)}
                                className="form-input py-1 text-xs"
                              >
                                <option value="">Select assignee</option>
                                {assessors.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {assigneeOptionLabel(a)}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => handleAssign(row.id, assignTo)}
                                className="btn-secondary px-2 py-1 text-xs"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setAssigningId(null)}
                                className="text-xs text-slate-500"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setAssigningId(row.id)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-accent-700"
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                              Allocate
                            </button>
                          ))}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDelete(row.id, row.serial_no)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
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
