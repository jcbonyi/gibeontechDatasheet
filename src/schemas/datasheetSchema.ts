import { z } from 'zod';
import { inspectionFormSchema } from '@/inspection/schemas/inspectionSchema';
import { CONDITION_ITEMS, DASHBOARD_WARNING_LIGHTS, FORM_TYPES } from '@/types/datasheet';

const formTypeSchema = z.enum(FORM_TYPES as [string, ...string[]]);

const documentItemSchema = z.object({
  received: z.boolean(),
  notes: z.string(),
});

const vehicleDiagramMarkSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  angle: z.number().default(0),
  zone: z.string().optional(),
});

const conditionSchema = z.object(
  Object.fromEntries(CONDITION_ITEMS.map((item) => [item, z.string()])) as Record<
    (typeof CONDITION_ITEMS)[number],
    z.ZodString
  >,
);

const dashboardWarningLightsSchema = z.object(
  Object.fromEntries(DASHBOARD_WARNING_LIGHTS.map((light) => [light.key, z.boolean()])) as Record<
    (typeof DASHBOARD_WARNING_LIGHTS)[number]['key'],
    z.ZodBoolean
  >,
);

const baseDatasheetSchema = z.object({
  header: z.object({
    formTypes: z.array(formTypeSchema).min(1, 'Select at least one form type'),
    date: z.string(),
    time: z.string(),
  }),
  basicInfo: z.object({
    documentsProvided: z.string(),
    clientInsurer: z.string(),
    ownerInsured: z.string(),
    instructedBy: z.string(),
    dateOfInstruction: z.string(),
    policyNo: z.string(),
    claimNo: z.string(),
    dateOfAccident: z.string(),
    regNo: z.string(),
    make: z.string(),
    modelNo: z.string(),
    year: z.string(),
    firstRegistered: z.string(),
    chassisNo: z.string(),
    engineNo: z.string(),
    sumInsured: z.string(),
    excess: z.string(),
  }),
  assessment: z.object({
    origin: z.string(),
    bodyType: z.string(),
    colour: z.string(),
    mileage: z.string(),
    engineCC: z.string(),
    fuelType: z.string(),
    tyreBrand: z.string(),
    tyreSize: z.string(),
    tyreType: z.enum(['Inflatable', 'Tubeless', '']),
    dashboardWarningLights: dashboardWarningLightsSchema,
    dashboardWarningLightsNotes: z.string(),
  }),
  vehicleCondition: conditionSchema,
  damage: z.object({
    damageSummary: z.string(),
    preAccidentDefects: z.string(),
    vehicleDiagram: z.array(vehicleDiagramMarkSchema),
    garageArrival: z.enum(['Towed', 'Driven', 'Carried', '']),
  }),
  parts: z.object({
    toBeReplaced: z.string(),
    toBePainted: z.string(),
    toBeRepaired: z.string(),
  }),
  remarks: z.string(),
  documents: z.object({
    claim_form: documentItemSchema,
    police_abstract: documentItemSchema,
    logbook: documentItemSchema,
    driver_statement: documentItemSchema,
    repair_quotation: documentItemSchema,
  }),
  signOff: z.object({
    repairerContactPerson: z.string(),
    repairerPhone: z.string(),
    seenBy: z.string(),
    signatureDateTime: z.string(),
    assessorSignature: z.string(),
    reviewedBy: z.string(),
    reviewedAt: z.string(),
  }),
  inspection: inspectionFormSchema.optional(),
});

export const datasheetFormSchema = baseDatasheetSchema.superRefine((data, ctx) => {
  const hasInspection = data.header.formTypes.includes('Inspection');
  const hasPreTheft = data.header.formTypes.includes('Pre-theft');

  if (hasInspection) {
    const result = inspectionFormSchema.safeParse(data.inspection);
    if (!result.success) {
      result.error.issues.forEach((issue) => {
        ctx.addIssue({
          ...issue,
          path: ['inspection', ...(issue.path || [])],
        });
      });
    }
  }

  if (hasInspection) return;

  if (!data.basicInfo.clientInsurer.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Client/Insurer is required',
      path: ['basicInfo', 'clientInsurer'],
    });
  }
  if (!data.basicInfo.regNo.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Registration number is required',
      path: ['basicInfo', 'regNo'],
    });
  }
  if (!data.damage.damageSummary.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: hasPreTheft
        ? 'Theft circumstances / summary is required'
        : 'Damage summary is required',
      path: ['damage', 'damageSummary'],
    });
  }
  // Garage arrival does not apply when the vehicle is stolen
  if (!hasPreTheft && !data.damage.garageArrival) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Select how the vehicle reached the garage',
      path: ['damage', 'garageArrival'],
    });
  }
  if (!data.signOff.seenBy.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Seen by is required',
      path: ['signOff', 'seenBy'],
    });
  }
  if (!data.signOff.signatureDateTime.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Signature date/time is required',
      path: ['signOff', 'signatureDateTime'],
    });
  }
  if (!data.signOff.assessorSignature.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Assessor signature is required',
      path: ['signOff', 'assessorSignature'],
    });
  }
});

export const draftDatasheetSchema = baseDatasheetSchema.deepPartial();

export type DatasheetFormInput = z.input<typeof datasheetFormSchema>;
