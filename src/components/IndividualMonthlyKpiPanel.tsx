'use client';

import { Target, TrendingUp } from 'lucide-react';
import { formatKpiAmount, type IndividualMonthlyKpiResult } from '@/lib/individualMonthlyKpis';

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
  target: string;
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
          <span className="mx-1 font-medium text-slate-400">/</span>
          {target}
          {pct != null ? (
            <span className={`ml-1.5 ${met ? 'text-emerald-700' : 'text-slate-500'}`}>
              {pct}%
            </span>
          ) : null}
        </p>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${barTone(pct, met)}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function KpiCard({
  kpi,
  highlight,
}: {
  kpi: IndividualMonthlyKpiResult;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        highlight
          ? 'border-brand-200 bg-gradient-to-br from-brand-50/80 to-white shadow-sm'
          : 'border-slate-100 bg-white'
      }`}
    >
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
      </div>
    </div>
  );
}

export type PersonalKpiPayload = {
  monthLabel: string;
  fromDate: string;
  toDate: string;
  me: IndividualMonthlyKpiResult | null;
  team?: IndividualMonthlyKpiResult[];
};

export function IndividualMonthlyKpiPanel({ data }: { data: PersonalKpiPayload }) {
  if (!data.me && !(data.team && data.team.length)) return null;

  return (
    <div className="section-card mb-4 !p-3 sm:!p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-800">
            <Target className="h-4 w-4 text-brand-600" />
            Monthly KPI
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {data.monthLabel} · Seen By instructions &amp; Done By production value
          </p>
        </div>
        <p className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
          <TrendingUp className="h-3 w-3" />
          Calendar month to date
        </p>
      </div>

      {data.me ? (
        <div className="mb-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Your performance
          </p>
          <KpiCard kpi={data.me} highlight />
        </div>
      ) : null}

      {data.team && data.team.length > 0 ? (
        <div>
          {data.me ? (
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Team targets
            </p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.team.map((kpi) => (
              <KpiCard key={kpi.key} kpi={kpi} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
