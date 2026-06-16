'use client';

import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { DatasheetFormData } from '@/types/datasheet';
import { FormField } from './FormField';

interface AdviceSectionProps {
  register: UseFormRegister<DatasheetFormData>;
  errors: FieldErrors<DatasheetFormData>;
  readOnly?: boolean;
}

export function AdviceSection({ register, errors, readOnly }: AdviceSectionProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <FormField
        label="Advice to Repairer"
        error={errors.advice?.adviceToRepairer?.message}
      >
        <textarea
          {...register('advice.adviceToRepairer')}
          rows={6}
          readOnly={readOnly}
          className="form-input resize-y"
          placeholder="Instructions or authorizations for the repairer/garage..."
        />
      </FormField>

      <FormField
        label="Advice to Insurer"
        error={errors.advice?.adviceToInsurer?.message}
      >
        <textarea
          {...register('advice.adviceToInsurer')}
          rows={6}
          readOnly={readOnly}
          className="form-input resize-y"
          placeholder="Professional recommendations, liability opinion, or settlement advice..."
        />
      </FormField>
    </div>
  );
}
