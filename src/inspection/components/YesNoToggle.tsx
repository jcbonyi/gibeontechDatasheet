'use client';

import { Check, X } from 'lucide-react';

interface YesNoToggleProps {
  value: 'yes' | 'no' | '';
  onChange: (value: 'yes' | 'no') => void;
  error?: string;
}

export function YesNoToggle({ value, onChange, error }: YesNoToggleProps) {
  return (
    <div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange('yes')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
            value === 'yes'
              ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
          }`}
        >
          <Check className="h-4 w-4" />
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange('no')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
            value === 'no'
              ? 'border-red-500 bg-red-50 text-red-700 ring-2 ring-red-500/20'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
          }`}
        >
          <X className="h-4 w-4" />
          No
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
