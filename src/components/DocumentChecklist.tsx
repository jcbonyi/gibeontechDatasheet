'use client';

import { Control, Controller, UseFormRegister } from 'react-hook-form';
import { CheckCircle2, Circle } from 'lucide-react';
import {
  countReceivedDocuments,
  DOCUMENT_CHECKLIST,
  DatasheetFormData,
} from '@/types/datasheet';
import { FormField } from './FormField';

interface DocumentChecklistProps {
  control: Control<DatasheetFormData>;
  register: UseFormRegister<DatasheetFormData>;
  documents: DatasheetFormData['documents'];
  readOnly?: boolean;
}

export function DocumentChecklist({
  control,
  register,
  documents,
  readOnly,
}: DocumentChecklistProps) {
  const progress = countReceivedDocuments(documents);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between rounded-xl border border-accent-200 bg-accent-50 px-4 py-3">
        <p className="text-sm font-medium text-accent-800">Required Documents</p>
        <p className="text-sm font-semibold text-accent-700">
          {progress.received}/{progress.total} received
        </p>
      </div>

      <div className="space-y-4">
        {DOCUMENT_CHECKLIST.map((item) => {
          const doc = documents[item.key];
          return (
            <div
              key={item.key}
              className={`rounded-xl border p-4 ${
                doc.received ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start gap-3">
                <Controller
                  name={`documents.${item.key}.received`}
                  control={control}
                  render={({ field }) => (
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => field.onChange(!field.value)}
                      className="mt-0.5 shrink-0 text-brand-600 disabled:cursor-not-allowed"
                      aria-label={`Mark ${item.label} as received`}
                    >
                      {field.value ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <Circle className="h-5 w-5 text-slate-300" />
                      )}
                    </button>
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800">{item.label}</p>
                  <FormField label="Notes" className="mt-3">
                    <input
                      {...register(`documents.${item.key}.notes`)}
                      readOnly={readOnly}
                      className="form-input"
                      placeholder="Optional notes..."
                    />
                  </FormField>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
