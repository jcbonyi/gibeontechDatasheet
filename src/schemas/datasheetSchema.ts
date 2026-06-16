import { z } from 'zod';
import { CONDITION_ITEMS, FORM_TYPES } from '@/types/datasheet';

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

export const datasheetFormSchema = z.object({
  header: z.object({
    formTypes: z.array(formTypeSchema).min(1, 'Select at least one form type'),
    date: z.string().min(1, 'Date is required'),
    time: z.string().min(1, 'Time is required'),
  }),
  basicInfo: z.object({
    documentsProvided: z.string(),
    clientInsurer: z.string().min(1, 'Client/Insurer is required'),
    ownerInsured: z.string().min(1, 'Owner/Insured is required'),
    instructedBy: z.string(),
    policyNo: z.string(),
    claimNo: z.string().min(1, 'Claim number is required'),
    dateOfAccident: z.string().min(1, 'Date of accident is required'),
    regNo: z.string().min(1, 'Registration number is required'),
    make: z.string().min(1, 'Make is required'),
    modelNo: z.string().min(1, 'Model is required'),
    year: z.string().min(4, 'Year is required'),
    firstRegistered: z.string(),
    chassisNo: z.string().min(1, 'Chassis number is required'),
    engineNo: z.string().min(1, 'Engine number is required'),
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
  }),
  vehicleCondition: conditionSchema,
  damage: z.object({
    damageSummary: z.string().min(1, 'Damage summary is required'),
    preAccidentDefects: z.string(),
    vehicleDiagram: z.array(vehicleDiagramMarkSchema),
    garageArrival: z.enum(['Towed', 'Driven', 'Carried', '']).refine((v) => v !== '', {
      message: 'Select how the vehicle reached the garage',
    }),
  }),
  advice: z.object({
    adviceToRepairer: z.string(),
    adviceToInsurer: z.string(),
  }),
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
    seenBy: z.string().min(1, 'Seen by is required'),
    signatureDateTime: z.string().min(1, 'Signature date/time is required'),
    assessorSignature: z.string().min(1, 'Assessor signature is required'),
  }),
});

export const draftDatasheetSchema = datasheetFormSchema.deepPartial();

export type DatasheetFormInput = z.input<typeof datasheetFormSchema>;
