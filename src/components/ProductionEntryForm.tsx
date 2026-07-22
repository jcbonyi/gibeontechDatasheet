'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  amountWithoutVat,
  ASSIGNMENT_TYPES,
  formatMoney,
  PRODUCTION_STATUS_LABELS,
  PRODUCTION_STATUSES,
  type AssignmentType,
  type ProductionStatus,
} from '@/lib/productionConfig';

interface Option {
  id: number;
  name: string;
}

interface EntryFormProps {
  entryId?: number;
  initial?: Partial<{
    production_date: string;
    insurer_id: number;
    insurer_name: string | null;
    registration_number: string;
    assignment?: AssignmentType | string | null;
    amount: number;
    done_by_user_id: number | null;
    done_by_name: string | null;
    seen_by_user_id: number | null;
    seen_by_name: string | null;
    instructed_by: string | null;
    instructed_by_name: string | null;
    remarks: string;
    status: ProductionStatus;
  }>;
  insurers: Option[];
  users: Option[];
  vatRate: number;
  onSaved?: (id: number) => void;
}

export function ProductionEntryForm({
  entryId,
  initial,
  insurers,
  users,
  vatRate,
  onSaved,
}: EntryFormProps) {
  const router = useRouter();
  const [productionDate, setProductionDate] = useState(
    initial?.production_date || new Date().toISOString().slice(0, 10),
  );
  const [insurerName, setInsurerName] = useState(
    initial?.insurer_name ||
      insurers.find((i) => i.id === initial?.insurer_id)?.name ||
      '',
  );
  const [regNo, setRegNo] = useState(initial?.registration_number || '');
  const [assignment, setAssignment] = useState(initial?.assignment || '');
  const [amount, setAmount] = useState(String(initial?.amount ?? ''));
  const [doneBy, setDoneBy] = useState(
    initial?.done_by_name ||
      users.find((u) => u.id === initial?.done_by_user_id)?.name ||
      '',
  );
  const [seenBy, setSeenBy] = useState(
    initial?.seen_by_name ||
      users.find((u) => u.id === initial?.seen_by_user_id)?.name ||
      '',
  );
  const [instructedBy, setInstructedBy] = useState(
    initial?.instructed_by || initial?.instructed_by_name || '',
  );
  const [remarks, setRemarks] = useState(initial?.remarks || '');
  const [status, setStatus] = useState<ProductionStatus>(initial?.status || 'completed');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!insurerName && initial?.insurer_id && insurers.length) {
      const match = insurers.find((i) => i.id === initial.insurer_id);
      if (match) setInsurerName(match.name);
    }
  }, [insurers, initial?.insurer_id, insurerName]);

  useEffect(() => {
    if (!doneBy && initial?.done_by_user_id && users.length) {
      const match = users.find((u) => u.id === initial.done_by_user_id);
      if (match) setDoneBy(match.name);
    }
  }, [users, initial?.done_by_user_id, doneBy]);

  useEffect(() => {
    if (!seenBy && initial?.seen_by_user_id && users.length) {
      const match = users.find((u) => u.id === initial.seen_by_user_id);
      if (match) setSeenBy(match.name);
    }
  }, [users, initial?.seen_by_user_id, seenBy]);

  const net = useMemo(() => {
    const n = Number(amount);
    if (!Number.isFinite(n)) return 0;
    return amountWithoutVat(n, vatRate);
  }, [amount, vatRate]);

  const payload = () => ({
    production_date: productionDate,
    insurer_name: insurerName.trim(),
    registration_number: regNo,
    assignment,
    amount: Number(amount),
    done_by_name: doneBy.trim() || null,
    seen_by_name: seenBy.trim() || null,
    instructed_by: instructedBy.trim() || null,
    remarks,
    status,
  });

  const save = async (andNew: boolean) => {
    setError('');
    setSaving(true);
    try {
      const res = await fetch(entryId ? `/api/production/${entryId}` : '/api/production', {
        method: entryId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Save failed');
        return;
      }
      if (andNew) {
        setRegNo('');
        setAssignment('');
        setAmount('');
        setRemarks('');
        setProductionDate(new Date().toISOString().slice(0, 10));
        onSaved?.(data.entry.id);
        return;
      }
      if (entryId) {
        onSaved?.(data.entry.id);
        router.push('/production/entries');
      } else {
        router.push(`/production/entries/${data.entry.id}`);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="section-card space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save(false);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="form-label">Date</label>
          <input
            type="date"
            className="form-input"
            value={productionDate}
            onChange={(e) => setProductionDate(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="form-label">Insurer</label>
          <input
            className="form-input"
            list="production-insurers"
            value={insurerName}
            onChange={(e) => setInsurerName(e.target.value)}
            placeholder="Type or select insurer"
            required
          />
          <datalist id="production-insurers">
            {insurers.map((i) => (
              <option key={i.id} value={i.name} />
            ))}
          </datalist>
          <p className="mt-1 text-xs text-slate-500">New names are created automatically</p>
        </div>
        <div>
          <label className="form-label">Registration Number</label>
          <input
            className="form-input uppercase"
            value={regNo}
            onChange={(e) => setRegNo(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="form-label">Assignment</label>
          <input
            className="form-input"
            list="production-assignments"
            value={assignment}
            onChange={(e) => setAssignment(e.target.value)}
            placeholder="e.g. Assessment"
          />
          <datalist id="production-assignments">
            {ASSIGNMENT_TYPES.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="form-label">Amount (incl. VAT)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="form-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="form-label">Amount without VAT</label>
          <input className="form-input bg-slate-50" value={formatMoney(net)} readOnly />
          <p className="mt-1 text-xs text-slate-500">Auto · VAT {(vatRate * 100).toFixed(0)}%</p>
        </div>
        <div>
          <label className="form-label">Status</label>
          <select
            className="form-input"
            value={status}
            onChange={(e) => setStatus(e.target.value as ProductionStatus)}
          >
            {PRODUCTION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PRODUCTION_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Done By</label>
          <input
            className="form-input"
            list="production-staff-done"
            value={doneBy}
            onChange={(e) => setDoneBy(e.target.value)}
            placeholder="Staff name"
          />
          <datalist id="production-staff-done">
            {users.map((u) => (
              <option key={u.id} value={u.name} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="form-label">Seen By</label>
          <input
            className="form-input"
            list="production-staff-seen"
            value={seenBy}
            onChange={(e) => setSeenBy(e.target.value)}
            placeholder="Staff name"
          />
          <datalist id="production-staff-seen">
            {users.map((u) => (
              <option key={u.id} value={u.name} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="form-label">Instructed By</label>
          <input
            className="form-input"
            value={instructedBy}
            onChange={(e) => setInstructedBy(e.target.value)}
            placeholder="Name or desk"
          />
        </div>
      </div>
      <div>
        <label className="form-label">Remarks</label>
        <textarea
          className="form-input resize-y"
          rows={3}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : entryId ? 'Save changes' : 'Save'}
        </button>
        {!entryId && (
          <button
            type="button"
            className="btn-secondary"
            disabled={saving}
            onClick={() => save(true)}
          >
            Save &amp; New
          </button>
        )}
        <Link href="/production/entries" className="btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}

export function useProductionLookups() {
  const [insurers, setInsurers] = useState<Option[]>([]);
  const [users, setUsers] = useState<Option[]>([]);
  const [vatRate, setVatRate] = useState(0.16);

  useEffect(() => {
    fetch('/api/insurers?active=1')
      .then((r) => r.json())
      .then((d) => setInsurers((d.insurers || []).map((i: { id: number; name: string }) => ({ id: i.id, name: i.name }))));
    fetch('/api/production/staff')
      .then((r) => r.json())
      .then((d) => setUsers(d.staff || []));
    fetch('/api/production/settings')
      .then((r) => r.json())
      .then((d) => setVatRate(Number(d.settings?.vat_rate) || 0.16));
  }, []);

  return { insurers, users, vatRate };
}
