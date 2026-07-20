'use client';

interface BarItem {
  label: string;
  value: number;
  color?: string;
}

const DEFAULT_COLORS = ['#3F3D99', '#26A69A', '#0EA5E9', '#8B5CF6', '#F59E0B', '#EF4444', '#64748B'];

export function SimpleBarChart({
  items,
  height = 180,
}: {
  items: BarItem[];
  height?: number;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="flex h-full items-end gap-2" style={{ minHeight: height }}>
      {items.map((item, idx) => {
        const pct = (item.value / max) * 100;
        const color = item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
        return (
          <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-xs font-semibold text-slate-700">{item.value}</span>
            <div className="flex w-full flex-1 items-end justify-center rounded-t bg-slate-100" style={{ minHeight: height - 40 }}>
              <div
                className="w-full max-w-[48px] rounded-t transition-all"
                style={{ height: `${Math.max(pct, item.value > 0 ? 6 : 0)}%`, backgroundColor: color }}
                title={`${item.label}: ${item.value}`}
              />
            </div>
            <span className="w-full truncate text-center text-[10px] font-medium uppercase tracking-wide text-slate-500">
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function SimpleHorizontalBars({ items }: { items: BarItem[] }) {
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="space-y-2.5">
      {items.map((item, idx) => {
        const pct = (item.value / max) * 100;
        const color = item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
        return (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium text-slate-700">{item.label}</span>
              <span className="shrink-0 font-semibold text-slate-800">{item.value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
      {items.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-500">No data for this period.</p>
      )}
    </div>
  );
}

export function SimpleLineChart({
  points,
  height = 160,
}: {
  points: { label: string; a: number; b: number }[];
  height?: number;
}) {
  if (!points.length) {
    return <p className="py-8 text-center text-sm text-slate-500">No volume data yet.</p>;
  }

  const max = Math.max(...points.flatMap((p) => [p.a, p.b]), 1);
  const w = 400;
  const h = height;
  const pad = 24;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;

  const toX = (i: number) => pad + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const toY = (v: number) => pad + innerH - (v / max) * innerH;

  const pathA = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(p.a)}`).join(' ');
  const pathB = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(p.b)}`).join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label="Volume over time">
        <path d={pathA} fill="none" stroke="#3F3D99" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathB} fill="none" stroke="#26A69A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={p.label}>
            <circle cx={toX(i)} cy={toY(p.a)} r="3.5" fill="#3F3D99" />
            <circle cx={toX(i)} cy={toY(p.b)} r="3.5" fill="#26A69A" />
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between gap-1 text-[10px] text-slate-500">
        {points.map((p) => (
          <span key={p.label} className="truncate text-center" style={{ width: `${100 / points.length}%` }}>
            {p.label.slice(5)}
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-brand-700" /> Created
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-accent-600" /> Approved
        </span>
      </div>
    </div>
  );
}
