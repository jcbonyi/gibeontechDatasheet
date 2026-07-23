'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Download, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import { formatMoney, PRODUCTION_STATUS_LABELS, type ProductionStatus } from '@/lib/productionConfig';
import { formatDisplayDate } from '@/lib/productionExport';
import { canDeleteProductionEntry, canManageProduction } from '@/lib/productionPermissions';
import { useAuth } from '@/context/AuthContext';
import { useProductionLookups } from '@/components/ProductionEntryForm';

interface EntryRow {
  id: number;
  production_date: string;
  registration_number: string;
  assignment?: string | null;
  insurer_name?: string | null;
  amount: number;
  amount_without_vat: number;
  done_by_name?: string | null;
  seen_by_name?: string | null;
  instructed_by_name?: string | null;
  status: ProductionStatus;
}

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function startOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function monthStart(offset = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset, 1);
  return d.toISOString().slice(0, 10);
}

function monthEnd(offset = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset + 1, 0);
  return d.toISOString().slice(0, 10);
}

function ProductionRegisterInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const { insurers, users } = useProductionLookups();
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [insurerId, setInsurerId] = useState('');
  const [doneBy, setDoneBy] = useState('');
  const [seenBy, setSeenBy] = useState('');
  const [instructedBy, setInstructedBy] = useState('');
  const [regNo, setRegNo] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [filtersReady, setFiltersReady] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const canDelete = canDeleteProductionEntry(user);
  const canImport = canManageProduction(user);

  // Apply filters from dashboard (and other) deep links
  useEffect(() => {
    setFromDate(searchParams.get('fromDate') || '');
    setToDate(searchParams.get('toDate') || '');
    setInsurerId(searchParams.get('insurerId') || '');
    setDoneBy(searchParams.get('doneBy') || '');
    setSeenBy(searchParams.get('seenBy') || '');
    setInstructedBy(searchParams.get('instructedBy') || '');
    setRegNo(searchParams.get('regNo') || '');
    setStatus(searchParams.get('status') || '');
    setQ(searchParams.get('q') || '');
    setFiltersReady(true);
  }, [searchParams]);

  const queryString = useCallback(() => {
    const p = new URLSearchParams();
    if (fromDate) p.set('fromDate', fromDate);
    if (toDate) p.set('toDate', toDate);
    if (insurerId) p.set('insurerId', insurerId);
    if (doneBy) p.set('doneBy', doneBy);
    if (seenBy) p.set('seenBy', seenBy);
    if (instructedBy) p.set('instructedBy', instructedBy);
    if (regNo) p.set('regNo', regNo);
    if (status) p.set('status', status);
    if (q) p.set('q', q);
    return p.toString();
  }, [doneBy, fromDate, instructedBy, insurerId, q, regNo, seenBy, status, toDate]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = queryString();
      const res = await fetch(`/api/production${qs ? `?${qs}` : ''}`);
      const data = await res.json();
      setEntries(data.entries || []);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    if (!filtersReady) return;
    load();
  }, [filtersReady, load]);

  const applyPreset = (preset: string) => {
    const today = dateOffset(0);
    if (preset === 'today') {
      setFromDate(today);
      setToDate(today);
    } else if (preset === 'yesterday') {
      const y = dateOffset(-1);
      setFromDate(y);
      setToDate(y);
    } else if (preset === 'week') {
      setFromDate(startOfWeek());
      setToDate(today);
    } else if (preset === 'lastWeek') {
      const end = new Date(startOfWeek());
      end.setDate(end.getDate() - 1);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      setFromDate(start.toISOString().slice(0, 10));
      setToDate(end.toISOString().slice(0, 10));
    } else if (preset === 'month') {
      setFromDate(monthStart(0));
      setToDate(today);
    } else if (preset === 'lastMonth') {
      setFromDate(monthStart(-1));
      setToDate(monthEnd(-1));
    } else {
      setFromDate('');
      setToDate('');
    }
  };

  const exportUrl = (format: string) => {
    const qs = queryString();
    return `/api/production/export?format=${format}${qs ? `&${qs}` : ''}`;
  };

  const handleDelete = async (id: number, reg: string) => {
    if (!confirm(`Delete production entry ${reg}?`)) return;
    const res = await fetch(`/api/production/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.message || 'Delete failed');
      return;
    }
    load();
  };

  const handleImport = async (file: File | null) => {
    if (!file) return;
    setImporting(true);
    setImportMessage('');
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/production/import', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) {
        const detail = (data.errors || [])
          .slice(0, 5)
          .map((e: { row: number; sheet?: string; message: string }) =>
            `${e.sheet ? `[${e.sheet}] ` : ''}Row ${e.row}: ${e.message}`,
          )
          .join('\n');
        setImportMessage(data.message || 'Import failed');
        if (detail) alert(`${data.message || 'Import failed'}\n\n${detail}`);
        return;
      }
      const warnCount = (data.warnings || []).length;
      const skipped = (data.sheetsSkipped || []).length;
      setImportMessage(
        `${data.message}${warnCount ? ` · ${warnCount} warning(s)` : ''}${
          skipped ? ` · ${skipped} sheet(s) skipped` : ''
        }`,
      );
      load();
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Production register</h1>
          <p className="page-subtitle">Searchable log of valuation production entries</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canImport && (
            <>
              <a href="/api/production/import" className="btn-secondary">
                <Download className="h-4 w-4" />
                Import template
              </a>
              <button
                type="button"
                className="btn-secondary"
                disabled={importing}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {importing ? 'Importing…' : 'Import Excel'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => handleImport(e.target.files?.[0] || null)}
              />
            </>
          )}
          <a href={exportUrl('xlsx')} className="btn-secondary">
            <Download className="h-4 w-4" />
            Excel
          </a>
          <a href={exportUrl('pdf')} className="btn-secondary">
            PDF
          </a>
          <Link href="/production/entries/new" className="btn-primary">
            <Plus className="h-4 w-4" />
            New entry
          </Link>
        </div>
      </div>

      {importMessage && (
        <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {importMessage}
        </p>
      )}

      <div className="section-card mb-4 !py-3 text-xs text-slate-500">
        Excel import reads <span className="font-semibold text-slate-700">every sheet</span> that
        has headers:{' '}
        <span className="font-semibold text-slate-700">
          DATE · INSURER · REG NO · ASSIGNMENT · AMOUNT · WITHOUT VAT · DONE BY · SEEN BY ·
          INSTRUCTED BY
        </span>
        . Missing insurers and Done/Seen staff names are created automatically. Instructed By and
        Assignment accept free text (known types are normalized when possible). Use the{' '}
        <span className="font-semibold text-slate-700">All</span> date preset to see every month
        after import.
      </div>

      <div className="section-card mb-4 !py-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {[
            ['today', 'Today'],
            ['yesterday', 'Yesterday'],
            ['week', 'This week'],
            ['lastWeek', 'Last week'],
            ['month', 'This month'],
            ['lastMonth', 'Last month'],
            ['all', 'All'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-brand-300 hover:bg-brand-50"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input type="date" className="form-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <input type="date" className="form-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          <select className="form-input" value={insurerId} onChange={(e) => setInsurerId(e.target.value)}>
            <option value="">All insurers</option>
            {insurers.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
          <input
            className="form-input"
            placeholder="Registration no."
            value={regNo}
            onChange={(e) => setRegNo(e.target.value)}
          />
          <select className="form-input" value={doneBy} onChange={(e) => setDoneBy(e.target.value)}>
            <option value="">Done by — all</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <select className="form-input" value={seenBy} onChange={(e) => setSeenBy(e.target.value)}>
            <option value="">Seen by — all</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <input
            className="form-input"
            placeholder="Instructed by…"
            value={instructedBy}
            onChange={(e) => setInstructedBy(e.target.value)}
          />
          <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <input
            className="form-input sm:col-span-2"
            placeholder="Search reg, insurer, staff, amount…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="button" className="btn-secondary" onClick={load}>
            <Search className="h-4 w-4" />
            Search
          </button>
        </div>
      </div>

      <div className="section-card overflow-x-auto">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No production entries match.</p>
        ) : (
          <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Reg No</th>
                    <th>Assignment</th>
                    <th>Insurer</th>
                    <th>Amount</th>
                    <th>Without VAT</th>
                    <th>Done By</th>
                    <th>Seen By</th>
                    <th>Instructed By</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td>{formatDisplayDate(e.production_date)}</td>
                      <td className="font-semibold text-brand-800">{e.registration_number}</td>
                      <td>{e.assignment || '—'}</td>
                      <td>{e.insurer_name || '—'}</td>
                      <td>{formatMoney(e.amount)}</td>
                      <td>{formatMoney(e.amount_without_vat)}</td>
                      <td>{e.done_by_name || '—'}</td>
                      <td>{e.seen_by_name || '—'}</td>
                      <td>{e.instructed_by_name || '—'}</td>
                      <td>{PRODUCTION_STATUS_LABELS[e.status]}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/production/entries/${e.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-brand-600"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </Link>
                      {canDelete && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs font-medium text-red-600"
                          onClick={() => handleDelete(e.id, e.registration_number)}
                        >
                          <Trash2 className="h-3 w-3" />
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
    </div>
  );
}

export function ProductionRegister() {
  return (
    <Suspense fallback={<div className="section-card text-sm text-slate-500">Loading register…</div>}>
      <ProductionRegisterInner />
    </Suspense>
  );
}
