'use client';

interface BarItem {
  label: string;
  value: number;
  color?: string;
  /** Optional drill-down payload (not shown in UI). */
  meta?: Record<string, string>;
}

const DEFAULT_COLORS = ['#3F3D99', '#26A69A', '#0EA5E9', '#8B5CF6', '#F59E0B', '#EF4444', '#64748B'];

export function SimpleBarChart({
  items,
  height = 180,
  hideEmpty = false,
  onItemClick,
}: {
  items: BarItem[];
  height?: number;
  /** When true, omit categories with value 0 */
  hideEmpty?: boolean;
  onItemClick?: (item: BarItem, index: number) => void;
}) {
  const visible = hideEmpty ? items.filter((i) => i.value > 0) : items;
  if (!visible.length) {
    return <p className="py-8 text-center text-sm text-slate-500">No data for this period.</p>;
  }

  const max = Math.max(...visible.map((i) => i.value), 1);
  const trackH = Math.max(height - 52, 96);
  const clickable = Boolean(onItemClick);

  return (
    <div className="flex items-end gap-2" style={{ minHeight: height }}>
      {visible.map((item, idx) => {
        const barH =
          item.value <= 0 ? 0 : Math.max(6, Math.round((item.value / max) * trackH));
        const color = item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
        return (
          <button
            key={`${item.label}-${idx}`}
            type="button"
            disabled={!clickable}
            onClick={clickable ? () => onItemClick!(item, idx) : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center gap-1.5 ${
              clickable
                ? 'cursor-pointer rounded-lg transition hover:bg-brand-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400'
                : ''
            }`}
            title={clickable ? `${item.label}: ${item.value} — click for list` : `${item.label}: ${item.value}`}
          >
            <span className="text-xs font-semibold tabular-nums text-slate-700">{item.value}</span>
            <div
              className="flex w-full items-end justify-center rounded-t bg-slate-100"
              style={{ height: trackH }}
            >
              <div
                className="w-full max-w-[48px] rounded-t transition-all"
                style={{ height: barH, backgroundColor: color }}
              />
            </div>
            <span
              className="w-full text-center text-[10px] font-medium uppercase leading-tight tracking-wide text-slate-500"
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function SimpleHorizontalBars({
  items,
  formatValue,
  maxHeight,
  onItemClick,
}: {
  items: BarItem[] | null | undefined;
  /** Display formatter for the numeric value (bar width still uses raw value). */
  formatValue?: (value: number) => string;
  /** Scroll when the list is long (e.g. full person lists). */
  maxHeight?: number;
  onItemClick?: (item: BarItem, index: number) => void;
}) {
  const list = items ?? [];
  if (!list.length) {
    return <p className="py-6 text-center text-sm text-slate-500">No data for this period.</p>;
  }

  const max = Math.max(...list.map((i) => Number(i.value) || 0), 1);
  const fmt = formatValue || ((v: number) => String(v));
  const clickable = Boolean(onItemClick);

  const body = (
    <div className="space-y-2.5">
      {list.map((item, idx) => {
        const value = Number(item.value) || 0;
        const pct = (value / max) * 100;
        const color = item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
        const RowTag = clickable ? 'button' : 'div';
        return (
          <RowTag
            key={`${item.label}-${idx}`}
            type={clickable ? 'button' : undefined}
            onClick={clickable ? () => onItemClick!(item, idx) : undefined}
            className={`block w-full text-left ${
              clickable
                ? 'cursor-pointer rounded-lg px-1 py-0.5 transition hover:bg-brand-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400'
                : ''
            }`}
            title={clickable ? 'Click to view list' : undefined}
          >
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium text-slate-700" title={item.label}>
                {item.label}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-800">
                {fmt(value)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </RowTag>
        );
      })}
    </div>
  );

  if (maxHeight != null) {
    return (
      <div className="overflow-y-auto pr-1" style={{ maxHeight }}>
        {body}
      </div>
    );
  }

  return body;
}

export function SimpleLineChart({
  points,
  height = 160,
  legendA = 'Created',
  legendB = 'Reports issued',
  onPointClick,
}: {
  points: { label: string; a: number; b: number; meta?: Record<string, string> }[];
  height?: number;
  legendA?: string;
  legendB?: string;
  onPointClick?: (point: { label: string; a: number; b: number; meta?: Record<string, string> }, index: number) => void;
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
            <circle
              cx={toX(i)}
              cy={toY(p.a)}
              r={onPointClick ? 8 : 3.5}
              fill="#3F3D99"
              fillOpacity={onPointClick ? 0.001 : 1}
              className={onPointClick ? 'cursor-pointer' : undefined}
              onClick={onPointClick ? () => onPointClick(p, i) : undefined}
            />
            {onPointClick ? (
              <circle cx={toX(i)} cy={toY(p.a)} r="3.5" fill="#3F3D99" pointerEvents="none" />
            ) : null}
            <circle cx={toX(i)} cy={toY(p.b)} r="3.5" fill="#26A69A" />
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between gap-1 text-[10px] text-slate-500">
        {points.map((p) => (
          <span key={p.label} className="truncate text-center" style={{ width: `${100 / points.length}%` }}>
            {p.label.includes('/') ? p.label : p.label.slice(5) || p.label}
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-brand-700" /> {legendA}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-accent-600" /> {legendB}
        </span>
      </div>
    </div>
  );
}
