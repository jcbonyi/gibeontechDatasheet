'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { canManageProductionAdmin } from '@/lib/productionPermissions';

export default function AdminProductionPage() {
  const { user } = useAuth();
  const [periodType, setPeriodType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [periodKey, setPeriodKey] = useState(() => new Date().toISOString().slice(0, 10));
  const [targetJobs, setTargetJobs] = useState('10');
  const [targetAmount, setTargetAmount] = useState('100000');
  const [vatRate, setVatRate] = useState('0.16');
  const [targets, setTargets] = useState<
    { id: number; period_type: string; period_key: string; target_jobs: number; target_amount: number }[]
  >([]);
  const [message, setMessage] = useState('');
  const [wiping, setWiping] = useState(false);

  const load = () => {
    fetch('/api/production/targets')
      .then((r) => r.json())
      .then((d) => setTargets(d.targets || []));
    fetch('/api/production/settings')
      .then((r) => r.json())
      .then((d) => setVatRate(String(d.settings?.vat_rate ?? '0.16')));
  };

  useEffect(() => {
    load();
  }, []);

  if (!canManageProductionAdmin(user)) {
    return (
      <AuthGuard>
        <AppShell>
          <p className="text-sm text-red-700">Admin access required.</p>
        </AppShell>
      </AuthGuard>
    );
  }

  const saveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/production/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period_type: periodType,
        period_key: periodKey,
        target_jobs: Number(targetJobs),
        target_amount: Number(targetAmount),
      }),
    });
    const data = await res.json();
    setMessage(res.ok ? 'Target saved' : data.message || 'Failed');
    load();
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/production/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vat_rate: Number(vatRate) }),
    });
    const data = await res.json();
    setMessage(res.ok ? 'Settings saved' : data.message || 'Failed');
  };

  const wipeAll = async () => {
    const ok = window.confirm(
      'Delete ALL production entries, insurers, and targets? This cannot be undone. VAT settings are kept.',
    );
    if (!ok) return;
    const typed = window.prompt('Type DELETE to confirm wiping all production data:');
    if (typed !== 'DELETE') {
      setMessage('Wipe cancelled');
      return;
    }
    setWiping(true);
    setMessage('');
    try {
      const res = await fetch('/api/production/wipe?confirm=DELETE_ALL_PRODUCTION', {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message || 'Wipe failed');
        return;
      }
      setMessage(
        `Wiped ${data.deleted?.entries ?? 0} entries, ${data.deleted?.insurers ?? 0} insurers, ${data.deleted?.targets ?? 0} targets. You can import fresh data now.`,
      );
      load();
    } finally {
      setWiping(false);
    }
  };

  return (
    <AuthGuard>
      <AppShell>
        <h1 className="page-title">Production admin</h1>
        <p className="page-subtitle">Targets, VAT settings &amp; insurer catalog</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/admin/insurers" className="btn-secondary">Manage insurers</Link>
          <Link href="/admin/users" className="btn-secondary">User accounts</Link>
          <Link href="/production" className="btn-secondary">Production dashboard</Link>
          <Link href="/production/entries" className="btn-secondary">Register &amp; import</Link>
        </div>

        {message && <p className="mt-4 text-sm text-emerald-600">{message}</p>}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <form onSubmit={saveTarget} className="section-card space-y-3">
            <h2 className="font-semibold">Production targets</h2>
            <select
              className="form-input"
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as 'daily' | 'weekly' | 'monthly')}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly (use week-start date)</option>
              <option value="monthly">Monthly (YYYY-MM)</option>
            </select>
            <input
              className="form-input"
              value={periodKey}
              onChange={(e) => setPeriodKey(e.target.value)}
              placeholder="2026-07-22 or 2026-07"
              required
            />
            <input
              className="form-input"
              type="number"
              value={targetJobs}
              onChange={(e) => setTargetJobs(e.target.value)}
              placeholder="Target jobs"
            />
            <input
              className="form-input"
              type="number"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="Target amount"
            />
            <button type="submit" className="btn-primary">Save target</button>
            <ul className="mt-4 space-y-1 text-sm text-slate-600">
              {targets.slice(0, 8).map((t) => (
                <li key={t.id}>
                  {t.period_type} · {t.period_key} · {t.target_jobs} jobs · {t.target_amount}
                </li>
              ))}
            </ul>
          </form>

          <form onSubmit={saveSettings} className="section-card space-y-3">
            <h2 className="font-semibold">System settings</h2>
            <label className="form-label">VAT rate (e.g. 0.16 = 16%)</label>
            <input
              className="form-input"
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              step="0.01"
              min="0"
              max="1"
            />
            <p className="text-xs text-slate-500">
              Reference rate only. Amount and Amount without VAT are entered separately (not
              auto-calculated).
            </p>
            <button type="submit" className="btn-primary">Save settings</button>
          </form>
        </div>

        {user?.role === 'Admin' && (
          <div className="section-card mt-6 space-y-3 border-red-200 bg-red-50/40">
            <h2 className="font-semibold text-red-800">Danger zone</h2>
            <p className="text-sm text-red-700">
              Delete all production entries, insurers, targets, and production notifications so you
              can import data afresh. VAT settings are preserved. Auto-created user accounts are not
              deleted.
            </p>
            <button
              type="button"
              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
              disabled={wiping}
              onClick={wipeAll}
            >
              {wiping ? 'Deleting…' : 'Delete all production data'}
            </button>
          </div>
        )}
      </AppShell>
    </AuthGuard>
  );
}
