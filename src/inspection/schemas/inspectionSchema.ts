import { z } from 'zod';

const conditionRatingSchema = z.enum(['excellent', 'good', 'fair', 'poor', 'na', '']);

const inspectionItemSchema = z.object({
  rating: conditionRatingSchema,
  remarks: z.string(),
});

const vehicleDetailsSchema = z.object({
  inspectionDate: z.string().min(1, 'Inspection date is required'),
  inspectionTime: z.string().min(1, 'Inspection time is required'),
  inspectorName: z.string().min(2, 'Inspector name is required'),
  registrationNumber: z.string().min(1, 'Registration number is required'),
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  yearOfManufacture: z
    .string()
    .min(4, 'Year is required')
    .regex(/^\d{4}$/, 'Enter a valid 4-digit year'),
  engineNumber: z.string().min(1, 'Engine number is required'),
  engineCC: z.string().refine((v) => v === '' || /^\d+$/.test(v), 'Enter a valid CC value'),
  chassisVin: z.string().min(5, 'Chassis/VIN number is required'),
  fuelType: z.string().min(1, 'Fuel type is required'),
  vehicleColor: z.string().min(1, 'Vehicle color is required'),
  odometerReading: z
    .string()
    .min(1, 'Odometer reading is required')
    .regex(/^\d+$/, 'Enter a valid odometer reading'),
  seatingCapacity: z
    .string()
    .min(1, 'Seating capacity is required')
    .regex(/^\d+$/, 'Enter a valid number'),
  vehicleUsage: z.string().min(1, 'Vehicle usage is required'),
  ownerName: z.string().min(2, 'Owner name is required'),
  ownerContact: z.string().min(5, 'Owner contact is required'),
  insuranceCompany: z.string(),
  policyNumber: z.string(),
  inspectionLocation: z.string().min(2, 'Inspection location is required'),
});

export const inspectionFormSchema = z.object({
  vehicleDetails: vehicleDetailsSchema,
  generalCondition: z.object({
    rating: conditionRatingSchema.refine((v) => v !== '', {
      message: 'Overall condition rating is required',
    }),
    comments: z.string(),
  }),
  mechanical: z.record(inspectionItemSchema),
  mechanicalRemarks: z.string(),
  electrical: z.record(inspectionItemSchema),
  electricalRemarks: z.string(),
  technical: z.record(inspectionItemSchema),
  technicalRemarks: z.string(),
  coachwork: z.record(inspectionItemSchema),
  coachworkRemarks: z.string(),
  bodyCondition: z.record(inspectionItemSchema),
  bodyDamage: z.object({
    scratches: z.string(),
    dents: z.string(),
    rust: z.string(),
    accidentDamage: z.string(),
    paintCondition: z.string(),
    missingParts: z.string(),
  }),
  bodyRemarks: z.string(),
  photos: z.object({
    frontView: z.string().min(1, 'Front view photo is required'),
    rearView: z.string().min(1, 'Rear view photo is required'),
    leftSideView: z.string().min(1, 'Left side view photo is required'),
    rightSideView: z.string().min(1, 'Right side view photo is required'),
    interiorDashboard: z.string().min(1, 'Interior dashboard photo is required'),
    odometerReading: z.string().min(1, 'Odometer photo is required'),
    engineBay: z.string().min(1, 'Engine bay photo is required'),
    chassisVin: z.string().min(1, 'Chassis/VIN photo is required'),
    existingDamage: z.string(),
  }),
  findings: z.object({
    roadworthy: z.enum(['yes', 'no', '']).refine((v) => v !== '', {
      message: 'Roadworthy status is required',
    }),
    preExistingDamage: z.enum(['yes', 'no', '']).refine((v) => v !== '', {
      message: 'Pre-existing damage status is required',
    }),
    repairsRecommended: z.enum(['yes', 'no', '']).refine((v) => v !== '', {
      message: 'Repairs recommended status is required',
    }),
    estimatedRepairCost: z.string(),
    additionalObservations: z.string(),
  }),
  declaration: z.object({
    inspectorSignature: z.string().min(2, 'Inspector signature is required'),
    inspectorDate: z.string().min(1, 'Inspector date is required'),
    ownerSignature: z.string().min(2, 'Owner/representative signature is required'),
    ownerDate: z.string().min(1, 'Owner/representative date is required'),
  }),
});

export type InspectionFormInput = z.input<typeof inspectionFormSchema>;
export type InspectionFormValues = z.output<typeof inspectionFormSchema>;
