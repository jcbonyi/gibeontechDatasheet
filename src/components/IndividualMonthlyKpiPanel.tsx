'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Target, TrendingUp, X } from 'lucide-react';
import {
  formatKpiAmount,
  type IndividualMonthlyKpiResult,
  type TeamOverallKpi,
} from '@/lib/individualMonthlyKpis';
import { downloadIndividualKpiPdf } from '@/utils/individualKpiPdf';
import { formatDisplayDate } from '@/lib/productionConfig';

function barTone(pct: number | null, met: boolean | null): string {
  if (met) return 'bg-emerald-500';
  if (pct == null) return 'bg-slate-300';
  if (pct >= 90) return 'bg-emerald-500';
  if (pct >= 70) return 'bg-amber-500';
  return 'bg-brand-500';
}

function ProgressRow({
  label,
  actual,
  target,
  pct,
  met,
}: {
  label: string;
  actual: string;
  target?: string;
  pct: number | null;
  met: boolean | null;
}) {
  const width = Math.min(100, Math.max(0, pct ?? 0));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-xs font-semibold text-slate-800">
          {actual}
          {target ? (
            <>
              <span className="mx-1 font-medium text-slate-400">/</span>
              {target}
            </>
          ) : null}
          {pct != null ? (
            <span className={`ml-1.5 ${met ? 'text-emerald-700' : 'text-slate-500'}`}>
              {pct}%
            </span>
          ) : null}
        </p>
      </div>
      {pct != null ? (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${barTone(pct, met)}`}
            style={{ width: `${width}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function KpiCard({
  kpi,
  highlight,
  onOpen,
}: {
  kpi: IndividualMonthlyKpiResult;
  highlight?: boolean;
  onOpen?: () => void;
}) {
  const body = (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="truncate text-sm font-bold text-slate-900">{kpi.label}</p>
        {kpi.amountMet && (kpi.seenMet === null || kpi.seenMet) ? (
          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
            On target
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            In progress
          </span>
        )}
      </div>
      <div className="space-y-2.5">
        {kpi.targetSeen != null ? (
          <ProgressRow
            label="Seen (instructions)"
            actual={String(kpi.seenJobs)}
            target={String(kpi.targetSeen)}
            pct={kpi.seenPct}
            met={kpi.seenMet}
          />
        ) : null}
        <ProgressRow
          label="Done By value"
          actual={formatKpiAmount(kpi.doneAmount)}
          target={formatKpiAmount(kpi.targetAmount)}
          pct={kpi.amountPct}
          met={kpi.amountMet}
        />
        <ProgressRow
          label="Pending now"
          actual={String(kpi.pendingJobs)}
          pct={null}
          met={null}
        />
      </div>
    </>
  );

  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={`w-full rounded-xl border p-3 text-left transition hover:border-brand-300 hover:shadow-sm ${
          highlight
            ? 'border-brand-200 bg-gradient-to-br from-brand-50/80 to-white shadow-sm'
            : 'border-slate-100 bg-white'
        }`}
      >
        {body}
      </button>
    );
  }

  return (
    <div
      className={`rounded-xl border p-3 ${
        highlight
          ? 'border-brand-200 bg-gradient-to-br from-brand-50/80 to-white shadow-sm'
          : 'border-slate-100 bg-white'
      }`}
    >
      {body}
    </div>
  );
}

function OverallCard({ overall, onOpen }: { overall: TeamOverallKpi; onOpen?: () => void }) {
  const inner = (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-900">Overall team performance</p>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Cumulative targets
        </span>
      </div>
      <ProgressRow
        label="Done By value"
        actual={formatKpiAmount(overall.doneAmount)}
        target={formatKpiAmount(overall.targetAmount)}
        pct={overall.amountPct}
        met={overall.amountPct >= 100}
      />
      {overall.seenPct != null ? (
        <ProgressRow
          label="Seen (instructions)"
          actual={String(overall.seenJobs)}
          target={String(overall.targetSeen)}
          pct={overall.seenPct}
          met={overall.seenPct >= 100}
        />
      ) : null}
      <ProgressRow
        label="Pending now"
        actual={String(overall.pendingJobs)}
        pct={null}
        met={null}
      />
      <p className="text-[11px] text-slate-500">
        {overall.peopleOnAmountTarget}/{overall.peopleCount} on value target
        {overall.targetSeen > 0
          ? ` · ${overall.peopleOnSeenTarget} on seen target`
          : ''}
      </p>
    </div>
  );

  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="mb-3 w-full rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/90 to-white p-3 text-left shadow-sm transition hover:border-violet-300 hover:shadow-md"
      >
        {inner}
      </button>
    );
  }
  return (
    <div className="mb-3 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/90 to-white p-3 shadow-sm">
      {inner}
    </div>
  );
}

export type PersonalKpiPayload = {
  periodKey: string;
  monthLabel: string;
  fromDate: string;
  toDate: string;
  isCurrent?: boolean;
  periods?: { key: string; label: string }[];
  me: IndividualMonthlyKpiResult | null;
  team?: IndividualMonthlyKpiResult[];
  overall?: TeamOverallKpi;
  canManageReports?: boolean;
};

type ModalScope = 'team' | string;

export function IndividualMonthlyKpiPanel({
  data: initial,
}: {
  data: PersonalKpiPayload;
}) {
  const [periodKey, setPeriodKey] = useState(initial.periodKey);
  const [payload, setPayload] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalScope, setModalScope] = useState<ModalScope>('team');

  useEffect(() => {
    setPayload(initial);
    setPeriodKey(initial.periodKey);
  }, [initial]);

  const loadPeriod = useCallback(async (month: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/personal-kpi?month=${encodeURIComponent(month)}`);
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setPayload(data);
        setPeriodKey(data.periodKey);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const canManage = Boolean(payload.canManageReports);
  const periods = payload.periods || [];

  const modalPeople = useMemo(() => {
    if (!payload.team) {
      return payload.me ? [payload.me] : [];
    }
    if (modalScope === 'team') return payload.team;
    return payload.team.filter((p) => p.key === modalScope);
  }, [modalScope, payload.me, payload.team]);

  const modalTitle =
    modalScope === 'team'
      ? `Team KPI · ${payload.monthLabel}`
      : `${modalPeople[0]?.label || 'Individual'} KPI · ${payload.monthLabel}`;

  const openModal = (scope: ModalScope) => {
    setModalScope(scope);
    setModalOpen(true);
  };

  const downloadPdf = () => {
    if (!modalPeople.length) return;
    downloadIndividualKpiPdf({
      title: modalTitle,
      subtitle: `${formatDisplayDate(payload.fromDate)} → ${formatDisplayDate(payload.toDate)} · Seen By / Done By / Pending`,
      scope: modalScope === 'team' ? 'team' : 'individual',
      people: modalPeople,
      overall: modalScope === 'team' ? payload.overall : null,
    });
  };

  if (!payload.me && !(payload.team && payload.team.length)) return null;

  return (
    <>
      <div className="section-card mb-4 !p-3 sm:!p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-800">
              <Target className="h-4 w-4 text-brand-600" />
              Monthly KPI
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {payload.monthLabel} · Seen By, Done By value &amp; pending jobs
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Period
              <select
                value={periodKey}
                disabled={loading}
                onChange={(e) => loadPeriod(e.target.value)}
                className="form-input ml-1 !inline-block !w-auto !py-1 text-xs"
              >
                {periods.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            {canManage ? (
              <button
                type="button"
                onClick={() => openModal('team')}
                className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-800 hover:bg-brand-100"
              >
                <FileText className="h-3.5 w-3.5" />
                Reports
              </button>
            ) : payload.me ? (
              <button
                type="button"
                onClick={() => openModal(payload.me!.key)}
                className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-800 hover:bg-brand-100"
              >
                <FileText className="h-3.5 w-3.5" />
                My report
              </button>
            ) : null}
            <p className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
              <TrendingUp className="h-3 w-3" />
              {payload.isCurrent ? 'Month to date' : 'Full month'}
            </p>
          </div>
        </div>

        {payload.overall && canManage ? (
          <OverallCard overall={payload.overall} onOpen={() => openModal('team')} />
        ) : null}

        {payload.me ? (
          <div className="mb-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Your performance
            </p>
            <KpiCard
              kpi={payload.me}
              highlight
              onOpen={canManage ? () => openModal(payload.me!.key) : () => openModal(payload.me!.key)}
            />
          </div>
        ) : null}

        {payload.team && payload.team.length > 0 && canManage ? (
          <div>
            {payload.me ? (
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Team targets
              </p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {payload.team.map((kpi) => (
                <KpiCard key={kpi.key} kpi={kpi} onOpen={() => openModal(kpi.key)} />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kpi-report-title"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/80 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h2 id="kpi-report-title" className="text-lg font-bold text-slate-900">
                  {modalTitle}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  {formatDisplayDate(payload.fromDate)} → {formatDisplayDate(payload.toDate)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-auto px-5 py-4">
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-xs font-medium text-slate-600">
                  Period
                  <select
                    value={periodKey}
                    disabled={loading}
                    onChange={(e) => loadPeriod(e.target.value)}
                    className="form-input mt-1 !py-1.5 text-sm"
                  >
                    {periods.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                {canManage ? (
                  <label className="text-xs font-medium text-slate-600">
                    Scope
                    <select
                      value={modalScope}
                      onChange={(e) => setModalScope(e.target.value)}
                      className="form-input mt-1 !py-1.5 text-sm"
                    >
                      <option value="team">Whole team</option>
                      {(payload.team || []).map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <button type="button" onClick={downloadPdf} className="btn-primary !py-2 text-sm">
                  <FileText className="h-4 w-4" />
                  Download PDF
                </button>
              </div>

              {modalScope === 'team' && payload.overall ? (
                <OverallCard overall={payload.overall} />
              ) : null}

              <div className="grid gap-2 sm:grid-cols-2">
                {modalPeople.map((kpi) => (
                  <KpiCard key={kpi.key} kpi={kpi} highlight={modalPeople.length === 1} />
                ))}
              </div>

              {modalPeople.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="data-table text-xs">
                    <thead>
                      <tr>
                        <th>Person</th>
                        <th>Seen</th>
                        <th>Value</th>
                        <th>Pending</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalPeople.map((p) => (
                        <tr key={p.key}>
                          <td className="font-semibold text-brand-800">{p.label}</td>
                          <td>
                            {p.targetSeen != null
                              ? `${p.seenJobs} / ${p.targetSeen} (${p.seenPct}%)`
                              : '—'}
                          </td>
                          <td>
                            {formatKpiAmount(p.doneAmount)} / {formatKpiAmount(p.targetAmount)} (
                            {p.amountPct}%)
                          </td>
                          <td>{p.pendingJobs}</td>
                          <td>
                            {p.amountMet && (p.seenMet === null || p.seenMet)
                              ? 'On target'
                              : 'In progress'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-slate-500">No KPI data for this selection.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
