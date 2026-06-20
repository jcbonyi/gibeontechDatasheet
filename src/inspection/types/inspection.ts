export type ConditionRating = 'excellent' | 'good' | 'fair' | 'poor' | 'na' | '';

export const CONDITION_RATINGS: { value: ConditionRating; label: string }[] = [
  { value: '', label: 'Select rating' },
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
  { value: 'na', label: 'N/A' },
];

export interface InspectionItem {
  rating: ConditionRating;
  remarks: string;
}

export interface VehicleDetails {
  inspectionDate: string;
  inspectionTime: string;
  inspectorName: string;
  registrationNumber: string;
  make: string;
  model: string;
  yearOfManufacture: string;
  engineNumber: string;
  engineCC: string;
  chassisVin: string;
  fuelType: string;
  vehicleColor: string;
  odometerReading: string;
  seatingCapacity: string;
  vehicleUsage: string;
  ownerName: string;
  ownerContact: string;
  insuranceCompany: string;
  policyNumber: string;
  inspectionLocation: string;
}

export interface BodyDamageFields {
  scratches: string;
  dents: string;
  rust: string;
  accidentDamage: string;
  paintCondition: string;
  missingParts: string;
}

export interface PhotoEvidence {
  frontView: string;
  rearView: string;
  leftSideView: string;
  rightSideView: string;
  interiorDashboard: string;
  odometerReading: string;
  engineBay: string;
  chassisVin: string;
  existingDamage: string;
}

export interface InspectorFindings {
  roadworthy: 'yes' | 'no' | '';
  preExistingDamage: 'yes' | 'no' | '';
  repairsRecommended: 'yes' | 'no' | '';
  estimatedRepairCost: string;
  additionalObservations: string;
}

export interface Declaration {
  inspectorSignature: string;
  inspectorDate: string;
  ownerSignature: string;
  ownerDate: string;
}

export type SystemsTab = 'mechanical' | 'electrical' | 'technical';
export type ExteriorTab = 'interior' | 'exterior' | 'damage';

export interface InspectionFormData {
  vehicleDetails: VehicleDetails;
  generalCondition: {
    rating: ConditionRating;
    comments: string;
  };
  mechanical: Record<string, InspectionItem>;
  mechanicalRemarks: string;
  electrical: Record<string, InspectionItem>;
  electricalRemarks: string;
  technical: Record<string, InspectionItem>;
  technicalRemarks: string;
  coachwork: Record<string, InspectionItem>;
  coachworkRemarks: string;
  bodyCondition: Record<string, InspectionItem>;
  bodyDamage: BodyDamageFields;
  bodyRemarks: string;
  photos: PhotoEvidence;
  findings: InspectorFindings;
  declaration: Declaration;
}

export const MECHANICAL_ITEMS = [
  'Engine Performance',
  'Engine Oil Level',
  'Cooling System',
  'Radiator',
  'Transmission/Gearbox',
  'Clutch System',
  'Differential',
  'Steering System',
  'Suspension',
  'Brake System',
  'Exhaust System',
  'Tyres Condition',
  'Spare Wheel',
  'Jack & Wheel Spanner',
] as const;

export const ELECTRICAL_ITEMS = [
  'Battery Condition',
  'Starter Motor',
  'Alternator/Charging System',
  'Headlights',
  'Tail Lights',
  'Brake Lights',
  'Indicators',
  'Horn',
  'Wipers',
  'Dashboard Instruments',
  'Air Conditioning',
] as const;

export const TECHNICAL_ITEMS = [
  'Speedometer Functionality',
  'Odometer Functionality',
  'ABS System',
  'Airbags',
  'Seat Belts',
  'Reverse Camera/Sensors',
  'ECU Diagnostic Status',
  'Warning Lights Present',
] as const;

export const COACHWORK_ITEMS = [
  'Driver Seat',
  'Passenger Seats',
  'Seat Covers',
  'Floor Carpets',
  'Roof Lining',
  'Dashboard & Console',
  'Door Panels',
  'Interior Trim',
  'Windows & Glass',
] as const;

export const BODY_ITEMS = [
  'Front Bumper',
  'Rear Bumper',
  'Bonnet',
  'Front Left Fender',
  'Front Right Fender',
  'Front Left Door',
  'Front Right Door',
  'Rear Left Door',
  'Rear Right Door',
  'Roof',
  'Boot/Tailgate',
  'Side Mirrors',
  'Windscreen',
] as const;

export const PHOTO_FIELDS: { key: keyof PhotoEvidence; label: string; required: boolean }[] = [
  { key: 'frontView', label: 'Front View', required: true },
  { key: 'rearView', label: 'Rear View', required: true },
  { key: 'leftSideView', label: 'Left Side View', required: true },
  { key: 'rightSideView', label: 'Right Side View', required: true },
  { key: 'interiorDashboard', label: 'Interior Dashboard', required: true },
  { key: 'odometerReading', label: 'Odometer Reading', required: true },
  { key: 'engineBay', label: 'Engine Bay', required: true },
  { key: 'chassisVin', label: 'Chassis/VIN Number', required: true },
  { key: 'existingDamage', label: 'Existing Damage Areas', required: false },
];

export const SYSTEMS_INSPECTION_GROUPS: {
  id: SystemsTab;
  label: string;
  description: string;
  items: readonly string[];
  remarksKey: 'mechanicalRemarks' | 'electricalRemarks' | 'technicalRemarks';
  dataKey: 'mechanical' | 'electrical' | 'technical';
}[] = [
  {
    id: 'mechanical',
    label: 'Mechanical',
    description: 'Engine, transmission, brakes, and drivetrain',
    items: MECHANICAL_ITEMS,
    remarksKey: 'mechanicalRemarks',
    dataKey: 'mechanical',
  },
  {
    id: 'electrical',
    label: 'Electrical',
    description: 'Battery, lighting, and electrical systems',
    items: ELECTRICAL_ITEMS,
    remarksKey: 'electricalRemarks',
    dataKey: 'electrical',
  },
  {
    id: 'technical',
    label: 'Technical & Safety',
    description: 'Safety systems, diagnostics, and instruments',
    items: TECHNICAL_ITEMS,
    remarksKey: 'technicalRemarks',
    dataKey: 'technical',
  },
];

export const PHOTO_GROUPS: { title: string; description: string; fields: { key: keyof PhotoEvidence; label: string; required: boolean }[] }[] = [
  {
    title: 'Exterior Views',
    description: 'All four sides of the vehicle',
    fields: PHOTO_FIELDS.filter((f) =>
      ['frontView', 'rearView', 'leftSideView', 'rightSideView'].includes(f.key),
    ),
  },
  {
    title: 'Interior & Mechanical',
    description: 'Dashboard, odometer, and engine bay',
    fields: PHOTO_FIELDS.filter((f) =>
      ['interiorDashboard', 'odometerReading', 'engineBay'].includes(f.key),
    ),
  },
  {
    title: 'Identification & Damage',
    description: 'VIN plate and any existing damage',
    fields: PHOTO_FIELDS.filter((f) => ['chassisVin', 'existingDamage'].includes(f.key)),
  },
];

export const BODY_DAMAGE_LABELS: Record<keyof BodyDamageFields, string> = {
  scratches: 'Scratches',
  dents: 'Dents',
  rust: 'Rust',
  accidentDamage: 'Accident Damage',
  paintCondition: 'Paint Condition',
  missingParts: 'Missing Parts',
};

export const FORM_SECTIONS = [
  { id: 'vehicle', title: 'Vehicle Details', number: 1 },
  { id: 'systems', title: 'Systems Inspection', number: 2 },
  { id: 'exterior', title: 'Exterior & Interior', number: 3 },
  { id: 'photos', title: 'Photographic Evidence', number: 4 },
  { id: 'assessment', title: 'Assessment & Conclusion', number: 5 },
  { id: 'declaration', title: 'Sign-off', number: 6 },
] as const;

export const FUEL_TYPES = ['Petrol', 'Diesel', 'Hybrid', 'Electric', 'LPG', 'CNG', 'Other'];
export const VEHICLE_USAGE_OPTIONS = [
  'Private',
  'Commercial',
  'PSV',
  'Taxi',
  'School Bus',
  'Government',
  'Rental',
  'Other',
];

function createInspectionItems(items: readonly string[]): Record<string, InspectionItem> {
  return Object.fromEntries(items.map((item) => [item, { rating: '', remarks: '' }]));
}

export function createDefaultFormData(): InspectionFormData {
  return {
    vehicleDetails: {
      inspectionDate: new Date().toISOString().split('T')[0],
      inspectionTime: new Date().toTimeString().slice(0, 5),
      inspectorName: '',
      registrationNumber: '',
      make: '',
      model: '',
      yearOfManufacture: '',
      engineNumber: '',
      engineCC: '',
      chassisVin: '',
      fuelType: '',
      vehicleColor: '',
      odometerReading: '',
      seatingCapacity: '',
      vehicleUsage: '',
      ownerName: '',
      ownerContact: '',
      insuranceCompany: '',
      policyNumber: '',
      inspectionLocation: '',
    },
    generalCondition: { rating: '', comments: '' },
    mechanical: createInspectionItems(MECHANICAL_ITEMS),
    mechanicalRemarks: '',
    electrical: createInspectionItems(ELECTRICAL_ITEMS),
    electricalRemarks: '',
    technical: createInspectionItems(TECHNICAL_ITEMS),
    technicalRemarks: '',
    coachwork: createInspectionItems(COACHWORK_ITEMS),
    coachworkRemarks: '',
    bodyCondition: createInspectionItems(BODY_ITEMS),
    bodyDamage: {
      scratches: '',
      dents: '',
      rust: '',
      accidentDamage: '',
      paintCondition: '',
      missingParts: '',
    },
    bodyRemarks: '',
    photos: {
      frontView: '',
      rearView: '',
      leftSideView: '',
      rightSideView: '',
      interiorDashboard: '',
      odometerReading: '',
      engineBay: '',
      chassisVin: '',
      existingDamage: '',
    },
    findings: {
      roadworthy: '',
      preExistingDamage: '',
      repairsRecommended: '',
      estimatedRepairCost: '',
      additionalObservations: '',
    },
    declaration: {
      inspectorSignature: '',
      inspectorDate: new Date().toISOString().split('T')[0],
      ownerSignature: '',
      ownerDate: '',
    },
  };
}

export function itemKey(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
}

export function formatRating(rating: ConditionRating): string {
  if (!rating) return 'Not assessed';
  if (rating === 'na') return 'N/A';
  return rating.charAt(0).toUpperCase() + rating.slice(1);
}
