'use client';

import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { DatasheetFormData } from '@/types/datasheet';
import { FormField } from './FormField';

interface RemarksSectionProps {
  register: UseFormRegister<DatasheetFormData>;
  errors: FieldErrors<DatasheetFormData>;
  readOnly?: boolean;
}

export function RemarksSection({ register, errors, readOnly }: RemarksSectionProps) {
  return (
    <FormField label="Remarks" error={errors.remarks?.message}>
      <textarea
        {...register('remarks')}
        rows={6}
        readOnly={readOnly}
        className="form-input resize-y"
        placeholder="General remarks, observations, or recommendations..."
      />
    </FormField>
  );
}
