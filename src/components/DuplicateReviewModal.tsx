'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Copy, Loader2, X } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import type { DuplicateGroup } from '@/lib/duplicateDetection';

interface Props {
  open: boolean;
  onClose: () => void;
  onResolved?: () => void;
}

export function DuplicateReviewModal({ open, onClose, onResolved }: Props) {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolvingKey, setResolvingKey] = useState<string | null>(null);
  const [keepByGroup, setKeepByGroup] = useState<Record<string, number>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/datasheets/duplicates');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || 'Failed to load duplicates');
        setGroups([]);
        return;
      }
      const next = (data.groups || []) as DuplicateGroup[];
      setGroups(next);
      const defaults: Record<string, number> = {};
      for (const g of next) defaults[g.key] = g.recommendedKeepId;
      setKeepByGroup(defaults);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setMessage('');
      load();
    }
  }, [open, load]);

  if (!open) return null;

  const resolveGroup = async (group: DuplicateGroup) => {
    const keepId = keepByGroup[group.key] ?? group.recommendedKeepId;
    const cancelIds = group.items.map((i) => i.id).filter((id) => id !== keepId);
    if (!cancelIds.length) {
      setError('Select a different task to keep, or there is nothing to cancel.');
      return;
    }
    const keepSerial = group.items.find((i) => i.id === keepId)?.serial_no || String(keepId);
    if (
      !window.confirm(
        `Keep ${keepSerial} and cancel ${cancelIds.length} duplicate${cancelIds.length === 1 ? '' : 's'} as “Duplicate file”?`,
      )
    ) {
      return;
    }

    setResolvingKey(group.key);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/datasheets/duplicates/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keepId,
          cancelIds,
          note: `Resolved duplicate group: ${group.matchLabel} · ${group.matchSummary}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || 'Failed to resolve duplicates');
        return;
      }
      setMessage(data.message || 'Duplicates resolved');
      await load();
      onResolved?.();
    } finally {
      setResolvingKey(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-[2px] sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="duplicate-review-title"
        className="my-4 w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="duplicate-review-title" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Copy className="h-5 w-5 text-brand-600" />
              Duplicate tasks
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Same claim/insurer or registration matches among open files. Keep one; cancel the rest.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[min(70vh,640px)] overflow-y-auto px-5 py-4">
          {message && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {message}
            </div>
          )}
          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Scanning for duplicates…
            </div>
          ) : groups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-14 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
              <p className="mt-2 text-sm font-medium text-slate-800">No open duplicate groups</p>
              <p className="text-xs text-slate-500">
                Matches use claim + insurer, registration + claim, or registration + insurer when claim is TBA.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {groups.map((group) => {
                const keepId = keepByGroup[group.key] ?? group.recommendedKeepId;
                const busy = resolvingKey === group.key;
                return (
                  <li
                    key={group.key}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-white px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {group.matchLabel}
                          <span className="ml-2 font-normal text-slate-500">
                            · {group.items.length} files
                          </span>
                        </p>
                        <p className="truncate text-xs text-slate-500">{group.matchSummary}</p>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => resolveGroup(group)}
                        className="btn-primary !px-3 !py-1.5 text-xs disabled:opacity-60"
                      >
                        {busy ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Resolving…
                          </>
                        ) : (
                          'Keep selected · cancel others'
                        )}
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-left text-sm">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-wide text-slate-500">
                            <th className="px-3 py-2 font-semibold">Keep</th>
                            <th className="px-3 py-2 font-semibold">Serial</th>
                            <th className="px-3 py-2 font-semibold">Claim / Reg</th>
                            <th className="px-3 py-2 font-semibold">Status</th>
                            <th className="px-3 py-2 font-semibold">Owner</th>
                            <th className="px-3 py-2 font-semibold">Age</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map((item) => {
                            const recommended = item.id === group.recommendedKeepId;
                            return (
                              <tr
                                key={item.id}
                                className={`border-t border-slate-100 bg-white ${
                                  item.id === keepId ? 'bg-brand-50/40' : ''
                                }`}
                              >
                                <td className="px-3 py-2">
                                  <input
                                    type="radio"
                                    name={`keep-${group.key}`}
                                    checked={item.id === keepId}
                                    onChange={() =>
                                      setKeepByGroup((prev) => ({ ...prev, [group.key]: item.id }))
                                    }
                                    className="h-4 w-4 accent-brand-600"
                                    aria-label={`Keep ${item.serial_no}`}
                                  />
                                  {recommended && (
                                    <span className="ml-1.5 text-[10px] font-semibold text-brand-700">
                                      Suggested
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <Link
                                    href={`/datasheets/${item.id}`}
                                    className="font-semibold text-brand-700 hover:text-brand-900"
                                  >
                                    {item.serial_no}
                                  </Link>
                                </td>
                                <td className="px-3 py-2">
                                  <div className="text-slate-800">{item.claim_no || '—'}</div>
                                  <div className="text-xs text-slate-500">{item.reg_no || '—'}</div>
                                </td>
                                <td className="px-3 py-2">
                                  <StatusBadge status={item.status} />
                                </td>
                                <td className="px-3 py-2 text-slate-600">
                                  {item.assigned_to_name || 'Unassigned'}
                                </td>
                                <td className="px-3 py-2 text-slate-600">
                                  {item.age_days != null ? `${item.age_days}d` : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button type="button" onClick={load} className="btn-secondary !px-3 !py-1.5 text-xs" disabled={loading}>
            Refresh
          </button>
          <button type="button" onClick={onClose} className="btn-primary !px-3 !py-1.5 text-xs">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
