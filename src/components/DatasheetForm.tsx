'use client';

import { useCallback, useEffect, useState } from 'react';
import { useForm, Controller, Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, FileText, RotateCcw, Save, Send } from 'lucide-react';
import { datasheetFormSchema } from '@/schemas/datasheetSchema';
import {
  CONDITION_ITEMS,
  createDefaultFormData,
  createDefaultInspectionFormData,
  DatasheetFormData,
  FORM_SECTIONS,
  FORM_TYPES,
  FUEL_TYPES,
  GARAGE_ARRIVAL_OPTIONS,
  TYRE_TYPE_OPTIONS,
  DASHBOARD_WARNING_LIGHTS,
  hasInspectionForm,
  isInspectionOnlyForm,
  type DatasheetStatus,
} from '@/types/datasheet';
import { EmbeddedInspectionForm } from '@/inspection/components/EmbeddedInspectionForm';
import {
  BODY_TYPES,
  ORIGIN_OPTIONS,
  TYRE_SIZES,
  getConditionOptionsForItem,
  withSelectPlaceholder,
} from '@/constants/vehicleOptions';
import { FormSection } from './FormSection';
import { FormField } from './FormField';
import { FormProgress } from './FormProgress';
import { RemarksSection } from './RemarksSection';
import { DocumentChecklist } from './DocumentChecklist';
import { VehicleDiagram } from './VehicleDiagram';
import { SignaturePad } from './SignaturePad';
import { exportDatasheetPdf } from '@/utils/pdfExport';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface DatasheetFormProps {
  initialData?: DatasheetFormData;
  datasheetId?: number;
  serialNo?: string;
  status?: DatasheetStatus;
  readOnly?: boolean;
  onSave: (data: DatasheetFormData, status: DatasheetStatus) => Promise<void>;
}

export function DatasheetForm({
  initialData,
  datasheetId,
  serialNo,
  status = 'draft',
  readOnly,
  onSave,
}: DatasheetFormProps) {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState('header');
  const [submitError, setSubmitError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<DatasheetFormData>({
    resolver: zodResolver(datasheetFormSchema) as Resolver<DatasheetFormData>,
    defaultValues: initialData || createDefaultFormData(),
  });

  const documents = watch('documents');
  const diagramMarks = watch('damage.vehicleDiagram');
  const formTypes = watch('header.formTypes');
  const isInspectionMode = hasInspectionForm(formTypes);
  const isInspectionOnly = isInspectionOnlyForm(formTypes);

  useEffect(() => {
    if (initialData) reset(initialData);
  }, [initialData, reset]);

  useEffect(() => {
    if (user?.name) {
      setValue('signOff.seenBy', user.name);
    }
  }, [user?.name, setValue]);

  const trackActiveSection = useCallback(() => {
    const offsets = FORM_SECTIONS.map((s) => {
      const el = document.getElementById(s.id);
      return { id: s.id, top: el ? el.getBoundingClientRect().top : Infinity };
    });
    const visible = offsets.filter((s) => s.top <= 140 && s.top > -400);
    if (visible.length > 0) {
      setActiveSection(visible[visible.length - 1].id);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', trackActiveSection, { passive: true });
    return () => window.removeEventListener('scroll', trackActiveSection);
  }, [trackActiveSection]);

  const autoSave = useCallback(async () => {
    if (readOnly || !datasheetId) return;
    setIsSaving(true);
    try {
      await onSave(getValues(), 'draft');
      setSaveMessage('Draft saved');
      setTimeout(() => setSaveMessage(''), 2000);
    } catch {
      setSaveMessage('Auto-save failed');
    } finally {
      setIsSaving(false);
    }
  }, [datasheetId, getValues, onSave, readOnly]);

  useEffect(() => {
    if (readOnly || !datasheetId) return;
    const timer = setInterval(autoSave, 30000);
    return () => clearInterval(timer);
  }, [autoSave, datasheetId, readOnly]);

  const navigateToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSection(id);
  };

  const toggleFormType = (type: (typeof FORM_TYPES)[number]) => {
    const current = getValues('header.formTypes');
    if (current.includes(type)) {
      const next = current.filter((t) => t !== type);
      setValue('header.formTypes', next, { shouldValidate: true });
    } else {
      const next = [...current, type];
      setValue('header.formTypes', next, { shouldValidate: true });
      if (type === 'Inspection' && !getValues('inspection')) {
        setValue('inspection', createDefaultInspectionFormData(user?.name));
      }
    }
  };

  const onSubmit = async (data: DatasheetFormData) => {
    setSubmitError('');
    try {
      await onSave(data, 'submitted');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit');
    }
  };

  const onSaveDraft = async () => {
    setSubmitError('');
    try {
      await onSave(getValues(), 'draft');
      setSaveMessage('Draft saved');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const onExportPdf = async () => {
    await exportDatasheetPdf(getValues(), serialNo || 'DRAFT');
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div
        className={
          isInspectionOnly
            ? 'space-y-6'
            : 'lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-8'
        }
      >
        {!isInspectionOnly && (
          <FormProgress activeSection={activeSection} onNavigate={navigateToSection} />
        )}

        <div className="space-y-6">
      {saveMessage && <p className="alert-success">{saveMessage}</p>}
      {isSaving && <p className="text-xs text-slate-500">Saving draft…</p>}

      <FormSection
        id="header"
        number={1}
        title="Header & Claim Details"
        description="Form type, date, and primary claim information"
      >
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <FormField label="Date" error={errors.header?.date?.message}>
            <input type="date" {...register('header.date')} readOnly={readOnly} className="form-input" />
          </FormField>
          <FormField label="Time" error={errors.header?.time?.message}>
            <input type="time" {...register('header.time')} readOnly={readOnly} className="form-input" />
          </FormField>
        </div>

        <FormField label="Form Type" required error={errors.header?.formTypes?.message}>
          <div className="flex flex-wrap gap-3">
            {FORM_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formTypes.includes(type)}
                  disabled={readOnly}
                  onChange={() => toggleFormType(type)}
                  className="rounded border-slate-300 text-brand-600"
                />
                {type}
              </label>
            ))}
          </div>
        </FormField>

        {!isInspectionOnly && (
          <>
        <FormField label="Documents Provided" className="mt-4">
          <textarea
            {...register('basicInfo.documentsProvided')}
            readOnly={readOnly}
            rows={3}
            className="form-input resize-y"
          />
        </FormField>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ['clientInsurer', 'Client/Insurer', true],
              ['ownerInsured', 'Owner/Insured', false],
              ['instructedBy', 'Instructed By', false],
              ['policyNo', 'Policy No.', false],
              ['claimNo', 'Claim No.', false],
              ['dateOfAccident', 'Date of Accident', false],
            ] as [keyof DatasheetFormData['basicInfo'], string, boolean][]
          ).map(([fieldKey, label, required]) => (
            <FormField
              key={fieldKey}
              label={label as string}
              required={required as boolean}
              error={
                errors.basicInfo?.[fieldKey as keyof DatasheetFormData['basicInfo']]?.message
              }
            >
              <input
                type={fieldKey === 'dateOfAccident' ? 'date' : 'text'}
                {...register(`basicInfo.${fieldKey as keyof DatasheetFormData['basicInfo']}`)}
                readOnly={readOnly}
                className="form-input"
              />
            </FormField>
          ))}
        </div>
          </>
        )}
      </FormSection>

      {isInspectionMode && (
        <Controller
          key={datasheetId ?? 'new-inspection'}
          name="inspection"
          control={control}
          render={({ field }) => (
            <EmbeddedInspectionForm
              value={field.value || createDefaultInspectionFormData(user?.name)}
              onChange={field.onChange}
              readOnly={readOnly}
              defaultInspectorName={user?.name}
            />
          )}
        />
      )}

      {!isInspectionOnly && (
        <>
      <FormSection
        id="vehicle"
        number={2}
        title="Vehicle & Financials"
        description="Vehicle identification and insurance financials"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ['regNo', 'Reg. No.', true],
              ['make', 'Make', false],
              ['modelNo', 'Model No.', false],
              ['year', 'Year', false],
              ['firstRegistered', "First Re'gd", false],
              ['chassisNo', 'Chassis No.', false],
              ['engineNo', 'Engine No.', false],
              ['sumInsured', 'Sum Insured', false],
              ['excess', 'Excess', false],
            ] as [keyof DatasheetFormData['basicInfo'], string, boolean][]
          ).map(([fieldKey, label, required]) => (
            <FormField
              key={fieldKey}
              label={label as string}
              required={required as boolean}
              error={
                errors.basicInfo?.[fieldKey as keyof DatasheetFormData['basicInfo']]?.message
              }
            >
              <input
                type={fieldKey === 'firstRegistered' ? 'date' : 'text'}
                {...register(`basicInfo.${fieldKey as keyof DatasheetFormData['basicInfo']}`)}
                readOnly={readOnly}
                className="form-input"
              />
            </FormField>
          ))}
        </div>
      </FormSection>

      <FormSection
        id="assessment"
        number={3}
        title="Assessment & Tyres"
        description="Additional vehicle specifications"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="Origin">
            <select {...register('assessment.origin')} disabled={readOnly} className="form-input">
              <option value="">Select origin</option>
              {ORIGIN_OPTIONS.map((origin) => (
                <option key={origin} value={origin}>
                  {origin}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Body Type">
            <select {...register('assessment.bodyType')} disabled={readOnly} className="form-input">
              <option value="">Select body type</option>
              {BODY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Colour">
            <input {...register('assessment.colour')} readOnly={readOnly} className="form-input" />
          </FormField>
          <FormField label="Mileage">
            <input {...register('assessment.mileage')} readOnly={readOnly} className="form-input" />
          </FormField>
          <FormField label="Engine CC">
            <input {...register('assessment.engineCC')} readOnly={readOnly} className="form-input" />
          </FormField>
          <FormField label="Fuel Type">
            <select {...register('assessment.fuelType')} disabled={readOnly} className="form-input">
              <option value="">Select fuel type</option>
              {FUEL_TYPES.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </FormField>
        </div>

        <h3 className="mb-3 mt-6 text-sm font-semibold text-slate-700">Tyres</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Brand">
            <input {...register('assessment.tyreBrand')} readOnly={readOnly} className="form-input" />
          </FormField>
          <FormField label="Size">
            <select {...register('assessment.tyreSize')} disabled={readOnly} className="form-input">
              <option value="">Select tyre size</option>
              {TYRE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Type">
            <select {...register('assessment.tyreType')} disabled={readOnly} className="form-input">
              {TYRE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </FormField>
        </div>
      </FormSection>

      <FormSection
        id="condition"
        number={4}
        title="Vehicle Condition"
        description="Assessment of vehicle components"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CONDITION_ITEMS.map((item) => {
            const options = withSelectPlaceholder(getConditionOptionsForItem(item));
            return (
              <FormField key={item} label={item}>
                <select
                  {...register(`vehicleCondition.${item}`)}
                  disabled={readOnly}
                  className="form-input"
                >
                  {options.map((option) => (
                    <option key={option || 'placeholder'} value={option}>
                      {option || 'Select condition'}
                    </option>
                  ))}
                </select>
              </FormField>
            );
          })}
        </div>

        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Dashboard Warning Lights Noted</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DASHBOARD_WARNING_LIGHTS.map((light) => (
              <label
                key={light.key}
                className={`flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 ${
                  readOnly ? 'cursor-default bg-slate-50' : 'cursor-pointer hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  {...register(`assessment.dashboardWarningLights.${light.key}`)}
                  disabled={readOnly}
                  className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
                />
                <span>{light.label}</span>
              </label>
            ))}
          </div>
          <FormField label="Additional Notes" className="mt-4">
            <textarea
              {...register('assessment.dashboardWarningLightsNotes')}
              readOnly={readOnly}
              rows={2}
              placeholder="Other warning lights or details..."
              className="form-input resize-y"
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection
        id="damage"
        number={5}
        title="Damage & Transport"
        description="Damage summary, diagram, and how vehicle reached garage"
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <FormField label="Damage Summary" required error={errors.damage?.damageSummary?.message}>
            <textarea
              {...register('damage.damageSummary')}
              readOnly={readOnly}
              rows={5}
              className="form-input resize-y"
            />
          </FormField>
          <FormField label="Pre-Accident Defects">
            <textarea
              {...register('damage.preAccidentDefects')}
              readOnly={readOnly}
              rows={5}
              className="form-input resize-y"
            />
          </FormField>
        </div>

        <div className="mt-6">
          <Controller
            name="damage.vehicleDiagram"
            control={control}
            render={({ field }) => (
              <VehicleDiagram
                marks={field.value}
                onChange={field.onChange}
                readOnly={readOnly}
              />
            )}
          />
        </div>

        <FormField
          label="How did vehicle reach garage?"
          required
          className="mt-6"
          error={errors.damage?.garageArrival?.message}
        >
          <div className="flex flex-wrap gap-4">
            {GARAGE_ARRIVAL_OPTIONS.filter((o) => o.value).map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  value={option.value}
                  {...register('damage.garageArrival')}
                  disabled={readOnly}
                  className="text-brand-600"
                />
                {option.label}
              </label>
            ))}
          </div>
        </FormField>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <FormField label="Parts to be Replaced">
            <textarea
              {...register('parts.toBeReplaced')}
              readOnly={readOnly}
              rows={4}
              className="form-input resize-y"
              placeholder="List parts to be replaced..."
            />
          </FormField>
          <FormField label="Parts to be Painted">
            <textarea
              {...register('parts.toBePainted')}
              readOnly={readOnly}
              rows={4}
              className="form-input resize-y"
              placeholder="List parts to be painted..."
            />
          </FormField>
          <FormField label="Parts to be Repaired">
            <textarea
              {...register('parts.toBeRepaired')}
              readOnly={readOnly}
              rows={4}
              className="form-input resize-y"
              placeholder="List parts to be repaired..."
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection
        id="advice"
        number={6}
        title="Remarks, Documents & Sign-off"
        description="Remarks, required documents, and assessor sign-off"
      >
        <RemarksSection register={register} errors={errors} readOnly={readOnly} />

        <div className="mt-8">
          <DocumentChecklist
            control={control}
            register={register}
            documents={documents}
            readOnly={readOnly}
          />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <FormField label="Repairer / Contact Person">
            <input
              {...register('signOff.repairerContactPerson')}
              readOnly={readOnly}
              className="form-input"
            />
          </FormField>
          <FormField label="Phone No.">
            <input {...register('signOff.repairerPhone')} readOnly={readOnly} className="form-input" />
          </FormField>
          <FormField label="Seen By" required error={errors.signOff?.seenBy?.message}>
            <input
              {...register('signOff.seenBy')}
              readOnly
              className="form-input bg-slate-50 text-slate-700"
              title="Filled automatically from your logged-in account"
            />
            <p className="mt-1 text-xs text-slate-500">Set automatically from your account</p>
          </FormField>
          <FormField
            label="Date and Time"
            required
            error={errors.signOff?.signatureDateTime?.message}
          >
            <input
              type="datetime-local"
              {...register('signOff.signatureDateTime')}
              readOnly={readOnly}
              className="form-input"
            />
          </FormField>
        </div>

        <FormField
          label="Assessor Signature"
          required
          className="mt-4"
          error={errors.signOff?.assessorSignature?.message}
        >
          <Controller
            name="signOff.assessorSignature"
            control={control}
            render={({ field }) => (
              <SignaturePad value={field.value} onChange={field.onChange} readOnly={readOnly} />
            )}
          />
        </FormField>
      </FormSection>
        </>
      )}

      {submitError && (
        <div className="alert-error">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {submitError}
        </div>
      )}

      {!readOnly && (
        <div className="form-action-bar flex flex-wrap gap-3">
          <Link href="/datasheets" className="btn-secondary">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <button type="button" onClick={onSaveDraft} className="btn-secondary" disabled={isSubmitting}>
            <Save className="h-4 w-4" />
            Save Draft
          </button>
          {status === 'draft' && (
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              <Send className="h-4 w-4" />
              {isSubmitting ? 'Submitting…' : isInspectionOnly ? 'Submit Inspection' : 'Submit Datasheet'}
            </button>
          )}
          <button type="button" onClick={onExportPdf} className="btn-secondary">
            <FileText className="h-4 w-4" />
            {isInspectionOnly ? 'Export Datasheet PDF' : 'Export PDF'}
          </button>
          <button
            type="button"
            onClick={() => reset(createDefaultFormData())}
            className="btn-secondary"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </div>
      )}

      {readOnly && (
        <div className="form-action-bar flex flex-wrap gap-3">
          <Link href="/datasheets" className="btn-secondary">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <button type="button" onClick={onExportPdf} className="btn-primary">
            <FileText className="h-4 w-4" />
            Export PDF
          </button>
          {status === 'submitted' && (
            <p className="mt-2 text-sm text-slate-500">This datasheet has been submitted.</p>
          )}
        </div>
      )}
        </div>
      </div>
    </form>
  );
}
