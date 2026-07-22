'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { useAuth } from '@/context/AuthContext';
import { createDefaultFormData, FORM_TYPES, type FormType } from '@/types/datasheet';
import { COMPANY } from '@/constants/brand';
import { fetchJson } from '@/lib/fetchJson';
import Link from 'next/link';
import { ArrowLeft, Camera, Send } from 'lucide-react';

export default function MobileAssessorPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [formTypes, setFormTypes] = useState<FormType[]>(['Assessment']);
  const [claimNo, setClaimNo] = useState('');
  const [regNo, setRegNo] = useState('');
  const [insurer, setInsurer] = useState('');
  const [instructionDate, setInstructionDate] = useState(new Date().toISOString().slice(0, 10));
  const [damage, setDamage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleType = (t: FormType) => {
    setFormTypes((prev) =>
      prev.includes(t) ? (prev.length === 1 ? prev : prev.filter((x) => x !== t)) : [...prev, t],
    );
  };

  const startTask = async (submit: boolean) => {
    setSaving(true);
    setError('');
    try {
      const formData = createDefaultFormData(
        user?.role === 'Assessor' ? user.name : '',
      );
      formData.header.formTypes = formTypes;
      formData.basicInfo.claimNo = claimNo;
      formData.basicInfo.regNo = regNo;
      formData.basicInfo.clientInsurer = insurer;
      formData.basicInfo.dateOfInstruction = instructionDate;
      formData.damage.damageSummary = damage;
      if (user?.role === 'Assessor' && user.name) {
        formData.signOff.seenBy = user.name;
      }

      const { ok, data } = await fetchJson<{ message?: string; datasheet: { id: number } }>(
        '/api/datasheets',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            formData,
            status: submit ? 'pending_review' : 'in_progress',
          }),
        },
      );
      if (!ok) throw new Error(data.message || 'Failed to create task');
      router.push(`/datasheets/${data.datasheet.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-b from-brand-50 to-slate-100 px-4 py-5">
        <div className="mx-auto max-w-md">
          <div className="mb-4 flex items-center justify-between">
            <Link href="/datasheets" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700">
              <ArrowLeft className="h-4 w-4" />
              Tasks
            </Link>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Field mode
            </span>
          </div>

          <div className="rounded-2xl border border-white bg-white p-5 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
              {COMPANY.shortName}
            </p>
            <h1 className="mt-1 text-xl font-bold text-slate-900">Quick instruction</h1>
            <p className="mt-1 text-sm text-slate-500">
              Capture essentials on site, then finish details on the full form.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="form-label">Form type</label>
                <div className="flex flex-wrap gap-2">
                  {FORM_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleType(t)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        formTypes.includes(t)
                          ? 'bg-brand-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="form-label">Date of Instruction</label>
                <input
                  type="date"
                  value={instructionDate}
                  onChange={(e) => setInstructionDate(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Client / Insurer</label>
                <input value={insurer} onChange={(e) => setInsurer(e.target.value)} className="form-input" />
              </div>
              <div>
                <label className="form-label">Claim No.</label>
                <input value={claimNo} onChange={(e) => setClaimNo(e.target.value)} className="form-input" />
              </div>
              <div>
                <label className="form-label">Reg. No.</label>
                <input value={regNo} onChange={(e) => setRegNo(e.target.value)} className="form-input" />
              </div>
              <div>
                <label className="form-label">Damage / findings (brief)</label>
                <textarea
                  value={damage}
                  onChange={(e) => setDamage(e.target.value)}
                  rows={3}
                  className="form-input resize-y"
                />
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="mt-5 grid gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => startTask(false)}
                className="btn-primary w-full py-3"
              >
                <Camera className="h-4 w-4" />
                {saving ? 'Saving…' : 'Start & open full form'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => startTask(true)}
                className="btn-secondary w-full py-3"
              >
                <Send className="h-4 w-4" />
                Create & submit for review
              </button>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
