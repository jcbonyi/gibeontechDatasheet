'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CalendarRange,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  Search,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { canViewAllDatasheets } from '@/lib/permissions';
import { StatusBadge } from '@/components/StatusBadge';
import type { DatasheetStatus } from '@/types/datasheet';

interface Row {
  id: number;
  serial_no: string;
  status: DatasheetStatus;
  claim_no: string | null;
  reg_no: string | null;
  client_insurer: string | null;
  date_of_instruction: string | null;
  age_days: number | null;
  assigned_to_name?: string | null;
}

function weekRange(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(monday), to: fmt(sunday) };
}

function monthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

const SCHEDULE_KEY = 'gibeontech-report-schedule';

export function ReportsHub() {
  const { user } = useAuth();
  const viewAll = user ? canViewAllDatasheets(user.role) : false;
  const [fromDate, setFromDate] = useState(weekRange().from);
  const [toDate, setToDate] = useState(weekRange().to);
  const [insurer, setInsurer] = useState('');
  const [insurers, setInsurers] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [scheduleDay, setScheduleDay] = useState('monday');
  const [scheduleNote, setScheduleNote] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SCHEDULE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { day?: string; note?: string };
        if (parsed.day) setScheduleDay(parsed.day);
        if (parsed.note) setScheduleNote(parsed.note);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    if (insurer) params.set('insurer', insurer);
    const res = await fetch(`/api/datasheets?${params}`);
    const data = await res.json();
    const list = (data.datasheets || []) as Row[];
    setRows(list);
    const names = [
      ...new Set(list.map((r) => r.client_insurer).filter(Boolean) as string[]),
    ].sort();
    setInsurers(names);
  }, [fromDate, insurer, toDate]);

  useEffect(() => {
    load();
  }, [load]);

  const qs = useMemo(() => {
    const params = new URLSearchParams();
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    if (insurer) params.set('insurer', insurer);
    return params.toString();
  }, [fromDate, insurer, toDate]);

  const download = (pack: string, format: string) => {
    const params = new URLSearchParams(qs);
    params.set('pack', pack);
    params.set('format', format);
    window.location.href = `/api/reports/export?${params}`;
  };

  const saveSchedule = () => {
    localStorage.setItem(
      SCHEDULE_KEY,
      JSON.stringify({ day: scheduleDay, note: scheduleNote, savedAt: new Date().toISOString() }),
    );
    setScheduleNote((n) => n || 'Reminder saved on this device — generate the pack each week from here.');
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Reports &amp; packs</h1>
          <p className="page-subtitle">
            Weekly ops packs, insurer client exports, and printable open queues
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/reports/print-queue" className="btn-secondary">
            <Printer className="h-4 w-4" />
            Print open queue
          </Link>
          <Link href="/analytics" className="btn-secondary">
            Analytics home
          </Link>
        </div>
      </div>

      <div className="section-card mb-6">
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => {
              const w = weekRange();
              setFromDate(w.from);
              setToDate(w.to);
            }}
          >
            <CalendarRange className="h-3.5 w-3.5" />
            This week
          </button>
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => {
              const m = monthRange();
              setFromDate(m.from);
              setToDate(m.to);
            }}
          >
            This month
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="form-input" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="form-input" />
          {viewAll && (
            <select value={insurer} onChange={(e) => setInsurer(e.target.value)} className="form-input">
              <option value="">All insurers</option>
              {insurers.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          )}
          <button type="button" onClick={load} className="btn-secondary">
            <Search className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="section-card">
          <h2 className="mb-2 text-sm font-semibold text-brand-800">Weekly ops pack</h2>
          <p className="mb-4 text-sm text-slate-600">
            Multi-sheet Excel with KPIs, ageing, assessors, and full register for the selected period.
          </p>
          <button type="button" className="btn-primary w-full" onClick={() => download('ops', 'xlsx')}>
            <FileSpreadsheet className="h-4 w-4" />
            Download Excel ops pack
          </button>
          <button
            type="button"
            className="btn-secondary mt-2 w-full"
            onClick={() => download('analytics-pdf', 'pdf')}
          >
            <FileText className="h-4 w-4" />
            Download PDF summary
          </button>
        </div>

        <div className="section-card">
          <h2 className="mb-2 text-sm font-semibold text-brand-800">Insurer client pack</h2>
          <p className="mb-4 text-sm text-slate-600">
            Filter by insurer above, then export a clean register for client reporting.
          </p>
          <button
            type="button"
            className="btn-primary w-full"
            disabled={!insurer}
            onClick={() => download('register', 'xlsx')}
          >
            <Download className="h-4 w-4" />
            {insurer ? `Excel for ${insurer}` : 'Select an insurer first'}
          </button>
        </div>

        <div className="section-card">
          <h2 className="mb-2 text-sm font-semibold text-brand-800">Scheduled pack reminder</h2>
          <p className="mb-3 text-sm text-slate-600">
            Save a weekly reminder on this device (no email). Generate the pack when due.
          </p>
          <select
            value={scheduleDay}
            onChange={(e) => setScheduleDay(e.target.value)}
            className="form-input mb-2"
          >
            {['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((d) => (
              <option key={d} value={d}>
                Every {d}
              </option>
            ))}
          </select>
          <textarea
            value={scheduleNote}
            onChange={(e) => setScheduleNote(e.target.value)}
            className="form-input mb-2"
            rows={2}
            placeholder="e.g. Send ops pack to Principal Officer"
          />
          <button type="button" className="btn-secondary w-full" onClick={saveSchedule}>
            Save reminder
          </button>
        </div>
      </div>

      <div className="section-card overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold text-brand-800">
          Preview ({rows.length} tasks in filter)
        </h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Serial</th>
              <th>Insurer</th>
              <th>Claim</th>
              <th>Status</th>
              <th>Age</th>
              <th>Assessor</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 40).map((r) => (
              <tr key={r.id}>
                <td className="font-semibold text-brand-800">{r.serial_no}</td>
                <td>{r.client_insurer || '—'}</td>
                <td>{r.claim_no || '—'}</td>
                <td><StatusBadge status={r.status} /></td>
                <td>{r.age_days != null ? `${r.age_days}d` : '—'}</td>
                <td>{r.assigned_to_name || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
