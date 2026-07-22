'use client';

import { useState } from 'react';
import { MessageSquarePlus, StickyNote } from 'lucide-react';
import {
  DELAY_REASONS,
  delayReasonLabel,
  type DelayNote,
  type DelayReasonCode,
} from '@/lib/opsConfig';

export function DelayNotesPanel({
  datasheetId,
  notes,
  onUpdated,
}: {
  datasheetId: number;
  notes: DelayNote[];
  onUpdated: (notes: DelayNote[]) => void;
}) {
  const [reasonCode, setReasonCode] = useState<DelayReasonCode | string>('awaiting_documents');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(notes.length === 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (note.trim().length < 3) {
      setError('Please enter at least 3 characters explaining the delay');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/datasheets/${datasheetId}/delay-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reasonCode, note: note.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Failed to save delay note');
        return;
      }
      onUpdated(data.delayNotes || []);
      setNote('');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const sorted = [...notes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="section-card mb-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-slate-800">Delay notes</h3>
          {notes.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
              {notes.length}
            </span>
          )}
        </div>
        <button
          type="button"
          className="btn-secondary !px-3 !py-1.5 text-xs"
          onClick={() => setOpen((v) => !v)}
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          {open ? 'Hide form' : 'Add delay reason'}
        </button>
      </div>

      <p className="mb-3 text-xs text-slate-500">
        Record why this file is delayed relative to the Date of Instruction / SLA — visible to
        management and on the activity timeline.
      </p>

      {open && (
        <form onSubmit={submit} className="mb-4 space-y-3 rounded-xl border border-amber-100 bg-amber-50/40 p-3">
          <div>
            <label className="form-label">Reason category</label>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              className="form-input"
            >
              {DELAY_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Explanation</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="form-input resize-y"
              placeholder="e.g. Awaiting police abstract from insured; chased on 22 Jul…"
              maxLength={2000}
              required
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save delay note'}
          </button>
        </form>
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-slate-500">No delay notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((entry) => (
            <li
              key={entry.id}
              className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-amber-900 ring-1 ring-amber-200">
                  {delayReasonLabel(entry.reasonCode)}
                </span>
                <span>{entry.createdByName}</span>
                <span>· {new Date(entry.createdAt).toLocaleString()}</span>
                {entry.ageDaysAtNote != null && (
                  <span>· Age {entry.ageDaysAtNote}d at note</span>
                )}
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-800">{entry.note}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
