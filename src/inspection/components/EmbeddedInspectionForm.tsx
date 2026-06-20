'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useForm, Controller, Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileText, ShieldCheck, AlertCircle } from 'lucide-react';
import { inspectionFormSchema } from '../schemas/inspectionSchema';
import {
  createDefaultFormData,
  InspectionFormData,
  COACHWORK_ITEMS,
  BODY_ITEMS,
  PHOTO_GROUPS,
  SYSTEMS_INSPECTION_GROUPS,
  BODY_DAMAGE_LABELS,
  CONDITION_RATINGS,
  FORM_SECTIONS,
  SystemsTab,
  ExteriorTab,
} from '../types/inspection';
import { FormSection } from './FormSection';
import { FormField } from './FormField';
import { ConditionRatingTable } from './ConditionRatingTable';
import { PhotoUpload } from './PhotoUpload';
import { VehicleDetailsSection } from './VehicleDetailsSection';
import { InspectionReport } from './InspectionReport';
import { TabGroup } from './TabGroup';
import { TabPanel } from './TabPanel';
import { YesNoToggle } from './YesNoToggle';
import { FormProgress } from './FormProgress';

interface EmbeddedInspectionFormProps {
  value?: InspectionFormData;
  onChange: (data: InspectionFormData) => void;
  readOnly?: boolean;
  defaultInspectorName?: string;
}

export function EmbeddedInspectionForm({
  value,
  onChange,
  readOnly,
  defaultInspectorName = '',
}: EmbeddedInspectionFormProps) {
  const [showReport, setShowReport] = useState(false);
  const [activeSystemsTab, setActiveSystemsTab] = useState<SystemsTab>('mechanical');
  const [activeExteriorTab, setActiveExteriorTab] = useState<ExteriorTab>('interior');
  const [activeSection, setActiveSection] = useState('vehicle');

  const {
    register,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<InspectionFormData>({
    resolver: zodResolver(inspectionFormSchema) as Resolver<InspectionFormData>,
    defaultValues: value || createDefaultFormData(),
    shouldUnregister: false,
  });

  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    const defaults = value || createDefaultFormData();
    if (defaultInspectorName && !defaults.vehicleDetails.inspectorName) {
      defaults.vehicleDetails.inspectorName = defaultInspectorName;
    }
    reset(defaults);
    initialized.current = true;
  }, [value, defaultInspectorName, reset]);

  useEffect(() => {
    if (!initialized.current) return;
    const subscription = watch((data) => {
      onChange(data as InspectionFormData);
    });
    return () => subscription.unsubscribe();
  }, [watch, onChange]);

  const inspectorName = watch('vehicleDetails.inspectorName');
  const ownerName = watch('vehicleDetails.ownerName');
  const formData = watch();

  const trackActiveSection = useCallback(() => {
    const offsets = FORM_SECTIONS.map((s) => {
      const el = document.getElementById(`inspection-${s.id}`);
      return { id: s.id, top: el ? el.getBoundingClientRect().top : Infinity };
    });
    const visible = offsets.filter((s) => s.top <= 160 && s.top > -400);
    if (visible.length > 0) {
      setActiveSection(visible[visible.length - 1].id);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', trackActiveSection, { passive: true });
    return () => window.removeEventListener('scroll', trackActiveSection);
  }, [trackActiveSection]);

  const navigateToSection = (id: string) => {
    document.getElementById(`inspection-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSection(id);
  };

  const handleExportPdf = async () => {
    const { exportToPdf } = await import('../utils/pdfExport');
    await exportToPdf(formData as InspectionFormData);
  };

  if (showReport) {
    return (
      <div>
        <div className="no-print mb-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setShowReport(false)} className="btn-secondary">
            ← Back to Inspection Form
          </button>
          <button type="button" onClick={handleExportPdf} className="btn-primary">
            <FileText className="h-4 w-4" />
            Download Inspection PDF
          </button>
        </div>
        <InspectionReport data={formData as InspectionFormData} />
      </div>
    );
  }

  return (
    <fieldset disabled={readOnly} className="min-w-0 border-0 p-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent-200 bg-accent-50/50 px-4 py-3">
        <p className="text-sm font-medium text-brand-800">Vehicle Inspection Module</p>
        <button type="button" onClick={() => setShowReport(true)} className="btn-secondary">
          Preview Report
        </button>
      </div>

      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-8">
        <FormProgress
          activeSection={activeSection}
          onNavigate={navigateToSection}
          sectionPrefix="inspection-"
        />

        <div className="space-y-6">
          <FormSection
            id="inspection-vehicle"
            number={1}
            title="Vehicle & Owner Details"
            description="Inspection context, vehicle identity, and owner information"
          >
            <VehicleDetailsSection register={register} errors={errors} />
          </FormSection>

          <FormSection
            id="inspection-systems"
            number={2}
            title="Systems Inspection"
            description="Mechanical, electrical, and safety systems"
          >
            <TabGroup
              tabs={SYSTEMS_INSPECTION_GROUPS.map((g) => ({
                id: g.id,
                label: g.label,
                description: g.description,
              }))}
              activeTab={activeSystemsTab}
              onChange={(id) => setActiveSystemsTab(id as SystemsTab)}
            />
            {SYSTEMS_INSPECTION_GROUPS.map((group) => (
              <TabPanel key={group.id} id={group.id} activeTab={activeSystemsTab}>
                <ConditionRatingTable items={group.items} sectionKey={group.dataKey} register={register} />
                <FormField label={`${group.label} Remarks`} className="mt-5">
                  <textarea
                    {...register(group.remarksKey)}
                    rows={3}
                    className="form-input resize-y"
                    placeholder={`Additional ${group.label.toLowerCase()} observations...`}
                  />
                </FormField>
              </TabPanel>
            ))}
          </FormSection>

          <FormSection
            id="inspection-exterior"
            number={3}
            title="Exterior & Interior Condition"
            description="Body panels, upholstery, and damage assessment"
          >
            <TabGroup
              tabs={[
                { id: 'interior', label: 'Interior', description: 'Seats, trim, and cabin condition' },
                { id: 'exterior', label: 'Body Panels', description: 'Exterior panels and glass' },
                { id: 'damage', label: 'Damage Notes', description: 'Scratches, dents, rust, and paint' },
              ]}
              activeTab={activeExteriorTab}
              onChange={(id) => setActiveExteriorTab(id as ExteriorTab)}
            />
            <TabPanel id="interior" activeTab={activeExteriorTab}>
              <ConditionRatingTable items={COACHWORK_ITEMS} sectionKey="coachwork" register={register} />
              <FormField label="Interior Remarks" className="mt-5">
                <textarea {...register('coachworkRemarks')} rows={3} className="form-input resize-y" />
              </FormField>
            </TabPanel>
            <TabPanel id="exterior" activeTab={activeExteriorTab}>
              <ConditionRatingTable items={BODY_ITEMS} sectionKey="bodyCondition" register={register} />
              <FormField label="Body Remarks" className="mt-5">
                <textarea {...register('bodyRemarks')} rows={3} className="form-input resize-y" />
              </FormField>
            </TabPanel>
            <TabPanel id="damage" activeTab={activeExteriorTab}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {(Object.keys(BODY_DAMAGE_LABELS) as (keyof typeof BODY_DAMAGE_LABELS)[]).map((field) => (
                  <FormField key={field} label={BODY_DAMAGE_LABELS[field]}>
                    <input type="text" {...register(`bodyDamage.${field}`)} className="form-input" />
                  </FormField>
                ))}
              </div>
            </TabPanel>
          </FormSection>

          <FormSection
            id="inspection-photos"
            number={4}
            title="Photographic Evidence"
            description="Document the vehicle condition with supporting images"
          >
            <div className="space-y-8">
              {PHOTO_GROUPS.map((group) => (
                <div key={group.title}>
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-slate-800">{group.title}</h3>
                    <p className="text-xs text-slate-500">{group.description}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {group.fields.map(({ key, label, required }) => (
                      <Controller
                        key={key}
                        name={`photos.${key}`}
                        control={control}
                        render={({ field }) => (
                          <PhotoUpload
                            label={label}
                            required={required}
                            value={field.value}
                            onChange={field.onChange}
                            error={errors.photos?.[key]?.message}
                          />
                        )}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </FormSection>

          <FormSection
            id="inspection-assessment"
            number={5}
            title="Assessment & Conclusion"
            description="Overall condition rating and inspector findings"
          >
            <div className="mb-6 rounded-xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-5">
              <div className="mb-4 flex items-center gap-2 text-brand-800">
                <ShieldCheck className="h-5 w-5" />
                <h3 className="font-semibold">Overall Assessment</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Overall Condition Rating" required error={errors.generalCondition?.rating?.message}>
                  <select {...register('generalCondition.rating')} className="form-input">
                    {CONDITION_RATINGS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="General Comments" className="sm:col-span-2">
                  <textarea {...register('generalCondition.comments')} rows={3} className="form-input resize-y" />
                </FormField>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Roadworthy" required error={errors.findings?.roadworthy?.message}>
                <Controller name="findings.roadworthy" control={control} render={({ field }) => (
                  <YesNoToggle value={field.value} onChange={field.onChange} />
                )} />
              </FormField>
              <FormField label="Pre-existing Damage Noted" required error={errors.findings?.preExistingDamage?.message}>
                <Controller name="findings.preExistingDamage" control={control} render={({ field }) => (
                  <YesNoToggle value={field.value} onChange={field.onChange} />
                )} />
              </FormField>
              <FormField label="Repairs Recommended" required error={errors.findings?.repairsRecommended?.message}>
                <Controller name="findings.repairsRecommended" control={control} render={({ field }) => (
                  <YesNoToggle value={field.value} onChange={field.onChange} />
                )} />
              </FormField>
              <FormField label="Estimated Repair Cost">
                <input type="text" {...register('findings.estimatedRepairCost')} className="form-input" />
              </FormField>
              <FormField label="Additional Observations" className="sm:col-span-2 lg:col-span-3">
                <textarea {...register('findings.additionalObservations')} rows={4} className="form-input resize-y" />
              </FormField>
            </div>
          </FormSection>

          <FormSection
            id="inspection-declaration"
            number={6}
            title="Sign-off & Declaration"
            description="Signatures to certify the inspection findings"
          >
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-5">
                <h3 className="mb-1 text-sm font-semibold text-slate-800">Inspector</h3>
                <p className="mb-4 text-sm text-slate-500">{inspectorName || defaultInspectorName || '—'}</p>
                <FormField label="Signature" required error={errors.declaration?.inspectorSignature?.message}>
                  <input type="text" {...register('declaration.inspectorSignature')} className="form-input font-serif italic" />
                </FormField>
                <FormField label="Date" required error={errors.declaration?.inspectorDate?.message} className="mt-4">
                  <input type="date" {...register('declaration.inspectorDate')} className="form-input" />
                </FormField>
              </div>
              <div className="rounded-xl border border-slate-200 p-5">
                <h3 className="mb-1 text-sm font-semibold text-slate-800">Owner / Representative</h3>
                <p className="mb-4 text-sm text-slate-500">{ownerName || '—'}</p>
                <FormField label="Signature" required error={errors.declaration?.ownerSignature?.message}>
                  <input type="text" {...register('declaration.ownerSignature')} className="form-input font-serif italic" />
                </FormField>
                <FormField label="Date" required error={errors.declaration?.ownerDate?.message} className="mt-4">
                  <input type="date" {...register('declaration.ownerDate')} className="form-input" />
                </FormField>
              </div>
            </div>
          </FormSection>

          {Object.keys(errors).length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Some inspection fields need attention before submit.
            </div>
          )}
        </div>
      </div>
    </fieldset>
  );
}
