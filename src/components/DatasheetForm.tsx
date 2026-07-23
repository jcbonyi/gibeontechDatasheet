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
  FORM_TYPE_HINTS,
  FUEL_TYPES,
  GARAGE_ARRIVAL_OPTIONS,
  TYRE_TYPE_OPTIONS,
  DASHBOARD_WARNING_LIGHTS,
  hasInspectionForm,
  hasPreTheftForm,
  needsAssessmentPrefill,
  type DatasheetStatus,
  type FormType,
} from '@/types/datasheet';
import {
  buildPretheftFrom,
  buildReinspectionFrom,
  buildSupplementaryFrom,
} from '@/lib/copyFromAssessment';
import { ASSESSOR_EDITABLE_STATUSES, normalizeStatus, STATUS_LABELS } from '@/lib/status';
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
import { ArrowLeft, Search } from 'lucide-react';

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
  status = 'instructed',
  readOnly,
  onSave,
}: DatasheetFormProps) {
  const { user } = useAuth();
  const currentStatus = normalizeStatus(status);
  const canSubmitForReview = ASSESSOR_EDITABLE_STATUSES.includes(currentStatus);
  const [activeSection, setActiveSection] = useState('header');
  const [submitError, setSubmitError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupMessage, setLookupMessage] = useState('');
  const [lookupMatches, setLookupMatches] = useState<
    { id: number; serial_no: string; reg_no: string | null; claim_no: string | null; client_insurer: string | null }[]
  >([]);

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
    shouldUnregister: false,
  });

  const documents = watch('documents');
  const diagramMarks = watch('damage.vehicleDiagram');
  const formTypes = watch('header.formTypes');
  const isInspectionMode = hasInspectionForm(formTypes);
  const isPreTheft = hasPreTheftForm(formTypes);
  const showAssessmentPrefill = needsAssessmentPrefill(formTypes);

  useEffect(() => {
    if (initialData) reset(initialData);
  }, [initialData, reset]);

  useEffect(() => {
    if (isInspectionMode && !getValues('inspection')) {
      setValue('inspection', createDefaultInspectionFormData(user?.name), { shouldDirty: false });
    }
  }, [getValues, isInspectionMode, setValue, user?.name]);

  useEffect(() => {
    if (isInspectionMode && user?.name) {
      setValue('inspection.vehicleDetails.inspectorName', user.name);
    }
  }, [isInspectionMode, setValue, user?.name]);

  useEffect(() => {
    if (!isInspectionMode && user?.role === 'Assessor' && user.name) {
      const current = getValues('signOff.seenBy');
      if (!String(current || '').trim()) {
        setValue('signOff.seenBy', user.name);
      }
    }
  }, [isInspectionMode, user?.role, user?.name, setValue, getValues]);

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
      await onSave(getValues(), currentStatus);
      setSaveMessage('Progress saved');
      setTimeout(() => setSaveMessage(''), 2000);
    } catch {
      setSaveMessage('Auto-save failed');
    } finally {
      setIsSaving(false);
    }
  }, [currentStatus, datasheetId, getValues, onSave, readOnly]);

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

    if (type === 'Inspection') {
      if (current.includes('Inspection')) {
        setValue('header.formTypes', ['Assessment'], { shouldValidate: true });
      } else {
        setValue('header.formTypes', ['Inspection'], { shouldValidate: true });
        if (!getValues('inspection')) {
          setValue('inspection', createDefaultInspectionFormData(user?.name));
        }
      }
      setLookupMessage('');
      setLookupMatches([]);
      return;
    }

    if (type === 'Pre-theft') {
      if (current.includes('Pre-theft')) {
        setValue('header.formTypes', ['Assessment'], { shouldValidate: true });
      } else {
        setValue('header.formTypes', ['Pre-theft'], { shouldValidate: true });
        const seeded = buildPretheftFrom(null, {
          seenBy: user?.role === 'Assessor' ? user.name : getValues('signOff.seenBy'),
        });
        // Keep any reg/claim already typed
        const currentBasic = getValues('basicInfo');
        seeded.basicInfo = {
          ...seeded.basicInfo,
          ...Object.fromEntries(
            Object.entries(currentBasic).filter(([, v]) => String(v || '').trim()),
          ),
          dateOfInstruction: seeded.basicInfo.dateOfInstruction,
        } as DatasheetFormData['basicInfo'];
        reset(seeded);
      }
      setLookupMessage('');
      setLookupMatches([]);
      return;
    }

    const withoutExclusive = current.filter((t) => t !== 'Inspection' && t !== 'Pre-theft');
    if (withoutExclusive.includes(type)) {
      const next = withoutExclusive.filter((t) => t !== type);
      setValue('header.formTypes', next.length ? next : ['Assessment'], { shouldValidate: true });
    } else {
      setValue('header.formTypes', [...withoutExclusive, type], { shouldValidate: true });
    }
  };

  const applyAssessmentPrefill = (
    source: DatasheetFormData,
    serial: string,
    target: Extract<FormType, 'Re-inspection' | 'Supplementary'>,
  ) => {
    const opts = {
      sourceSerial: serial,
      seenBy: user?.role === 'Assessor' ? user.name : getValues('signOff.seenBy'),
    };
    const built =
      target === 'Re-inspection'
        ? buildReinspectionFrom(source, opts)
        : buildSupplementaryFrom(source, opts);
    // Preserve whichever follow-up types are currently selected
    const keepTypes = getValues('header.formTypes').filter(
      (t) => t === 'Re-inspection' || t === 'Supplementary',
    ) as FormType[];
    built.header.formTypes = keepTypes.length ? keepTypes : [target];
    reset(built);
    setLookupMessage(`Loaded vehicle & claim details from Assessment ${serial}`);
    setLookupMatches([]);
  };

  const lookupAssessment = async () => {
    const regNo = getValues('basicInfo.regNo')?.trim();
    const claimNo = getValues('basicInfo.claimNo')?.trim();
    if (!regNo && !claimNo) {
      setLookupMessage('Enter registration number and/or claim number first');
      return;
    }
    setLookupBusy(true);
    setLookupMessage('');
    try {
      const params = new URLSearchParams();
      if (regNo) params.set('regNo', regNo);
      if (claimNo) params.set('claimNo', claimNo);
      const res = await fetch(`/api/datasheets/lookup?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setLookupMessage(data.message || 'Lookup failed');
        return;
      }
      setLookupMatches(data.matches || []);
      if (!data.matches?.length) {
        setLookupMessage('No prior Assessment found for this vehicle / claim');
        return;
      }
      if (data.matched && data.formData) {
        const prefer: Extract<FormType, 'Re-inspection' | 'Supplementary'> =
          formTypes.includes('Re-inspection') ? 'Re-inspection' : 'Supplementary';
        applyAssessmentPrefill(data.formData, data.matched.serial_no, prefer);
      }
    } catch {
      setLookupMessage('Lookup failed');
    } finally {
      setLookupBusy(false);
    }
  };

  const loadMatchById = async (id: number, serial: string) => {
    setLookupBusy(true);
    try {
      const res = await fetch(`/api/datasheets/${id}`);
      const data = await res.json();
      if (!res.ok || !data.datasheet?.form_data) {
        setLookupMessage(data.message || 'Could not load Assessment');
        return;
      }
      const prefer: Extract<FormType, 'Re-inspection' | 'Supplementary'> =
        formTypes.includes('Re-inspection') ? 'Re-inspection' : 'Supplementary';
      applyAssessmentPrefill(data.datasheet.form_data, serial, prefer);
    } finally {
      setLookupBusy(false);
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
      const next =
        currentStatus === 'instructed' || currentStatus === 'allocated'
          ? 'in_progress'
          : currentStatus;
      await onSave(getValues(), next);
      setSaveMessage('Progress saved');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const onExportPdf = async () => {
    if (isInspectionMode && getValues('inspection')) {
      const { exportToPdf } = await import('@/inspection/utils/pdfExport');
      await exportToPdf(getValues('inspection')!);
      return;
    }
    await exportDatasheetPdf(getValues(), serialNo || 'DRAFT');
  };

  return (
    <div>
      <div
        className={
          isInspectionMode
            ? 'space-y-6'
            : 'lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-8'
        }
      >
        {!isInspectionMode && (
          <FormProgress activeSection={activeSection} onNavigate={navigateToSection} />
        )}

        <div className="space-y-6">
      {saveMessage && <p className="alert-success">{saveMessage}</p>}
      {isSaving && <p className="text-xs text-slate-500">Saving draft…</p>}

      <FormSection
        id="header"
        number={1}
        title={isInspectionMode ? 'Header' : 'Header & Claim Details'}
        description={
          isInspectionMode
            ? 'Form type, date, and time'
            : 'Form type, date, and primary claim information'
        }
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
              <label
                key={type}
                className="flex items-center gap-2 text-sm"
                title={FORM_TYPE_HINTS[type]}
              >
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
          {formTypes.map((t) => (
            <p key={t} className="mt-1 text-xs text-slate-500">
              {FORM_TYPE_HINTS[t]}
            </p>
          ))}
        </FormField>

        {showAssessmentPrefill && !readOnly && (
          <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/60 p-4">
            <p className="text-sm font-semibold text-brand-900">
              Load from prior Assessment
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Enter registration and/or claim number, then load vehicle and claim details from an
              existing Assessment. Re-inspection keeps identity for post-repair notes;
              Supplementary also carries prior parts for missed items.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={lookupBusy}
                onClick={lookupAssessment}
              >
                <Search className="h-4 w-4" />
                {lookupBusy ? 'Looking up…' : 'Find Assessment'}
              </button>
            </div>
            {lookupMessage && <p className="mt-2 text-sm text-slate-700">{lookupMessage}</p>}
            {lookupMatches.length > 1 && (
              <ul className="mt-2 space-y-1 text-sm">
                {lookupMatches.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="font-medium text-brand-700 hover:underline"
                      onClick={() => loadMatchById(m.id, m.serial_no)}
                    >
                      {m.serial_no}
                    </button>
                    <span className="text-slate-500">
                      {m.reg_no || '—'} · {m.claim_no || '—'} · {m.client_insurer || '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {isPreTheft && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Pre-theft is only for stolen subject vehicles. Garage arrival and repair advice are not
            required.
          </p>
        )}

        {!isInspectionMode && (
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
              ['dateOfInstruction', 'Date of Instruction', false],
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
                type={
                  fieldKey === 'dateOfAccident' || fieldKey === 'dateOfInstruction'
                    ? 'date'
                    : 'text'
                }
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
        <EmbeddedInspectionForm
          control={control}
          register={register}
          watch={watch}
          errors={errors}
          readOnly={readOnly}
        />
      )}

      {!isInspectionMode && (
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

      {!isPreTheft && (
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
      )}

      <FormSection
        id="damage"
        number={5}
        title={isPreTheft ? 'Theft circumstances' : 'Damage & Transport'}
        description={
          isPreTheft
            ? 'Circumstances of theft — vehicle not available for inspection'
            : formTypes.includes('Re-inspection')
              ? 'Post-repair observations (fresh notes — prior Assessment damage is in Remarks)'
              : formTypes.includes('Supplementary')
                ? 'Additional or missed damage / repairs'
                : 'Damage summary, diagram, and how vehicle reached garage'
        }
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <FormField
            label={isPreTheft ? 'Theft circumstances / summary' : 'Damage Summary'}
            required
            error={errors.damage?.damageSummary?.message}
          >
            <textarea
              {...register('damage.damageSummary')}
              readOnly={readOnly}
              rows={5}
              className="form-input resize-y"
              placeholder={
                isPreTheft
                  ? 'When/where stolen, last known location, police OB number…'
                  : formTypes.includes('Re-inspection')
                    ? 'Post-repair condition and observations…'
                    : formTypes.includes('Supplementary')
                      ? 'Additional or missed damage items…'
                      : undefined
              }
            />
          </FormField>
          {!isPreTheft && (
            <FormField label="Pre-Accident Defects">
              <textarea
                {...register('damage.preAccidentDefects')}
                readOnly={readOnly}
                rows={5}
                className="form-input resize-y"
              />
            </FormField>
          )}
        </div>

        {!isPreTheft && (
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
        )}

        {!isPreTheft && (
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
        )}

        {!isPreTheft && (
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
        )}
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
            formTypes={formTypes}
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
              readOnly={readOnly || user?.role === 'Assessor'}
              className={
                readOnly || user?.role === 'Assessor'
                  ? 'form-input bg-slate-50 text-slate-700'
                  : 'form-input'
              }
              title={
                user?.role === 'Assessor'
                  ? 'Filled automatically from your Assessor account'
                  : undefined
              }
            />
            {user?.role === 'Assessor' && (
              <p className="mt-1 text-xs text-slate-500">
                Set from your Assessor account when empty. As Seen By, you can set Done By on this task.
              </p>
            )}
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
          <FormField label="Reviewed by (Principal / Ops)">
            <input
              {...register('signOff.reviewedBy')}
              readOnly={readOnly}
              className="form-input"
              placeholder="Name of reviewing officer"
            />
          </FormField>
          <FormField label="Review date/time">
            <input
              type="datetime-local"
              {...register('signOff.reviewedAt')}
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
            Back to tasks
          </Link>
          <button type="button" onClick={onSaveDraft} className="btn-secondary" disabled={isSubmitting}>
            <Save className="h-4 w-4" />
            Save progress
          </button>
          {canSubmitForReview && (
            <button type="button" onClick={handleSubmit(onSubmit)} className="btn-primary" disabled={isSubmitting}>
              <Send className="h-4 w-4" />
              {isSubmitting ? 'Submitting…' : 'Submit for review'}
            </button>
          )}
          <button type="button" onClick={onExportPdf} className="btn-secondary">
            <FileText className="h-4 w-4" />
            {isInspectionMode ? 'Export Inspection PDF' : 'Export PDF'}
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
            Back to tasks
          </Link>
          <button type="button" onClick={onExportPdf} className="btn-primary">
            <FileText className="h-4 w-4" />
            Export PDF
          </button>
          <p className="w-full text-sm text-slate-500">
            Status: {STATUS_LABELS[currentStatus]} — editing is locked for this stage.
          </p>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
