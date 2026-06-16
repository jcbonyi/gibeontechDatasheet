export type DatasheetStatus = 'draft' | 'submitted';

export type FormType = 'Assessment' | 'Re-inspection' | 'Supplementary' | 'Technical';

export const FORM_TYPES: FormType[] = [
  'Assessment',
  'Re-inspection',
  'Supplementary',
  'Technical',
];

export type GarageArrival = 'Towed' | 'Driven' | 'Carried' | '';

export const GARAGE_ARRIVAL_OPTIONS: { value: GarageArrival; label: string }[] = [
  { value: '', label: 'Select option' },
  { value: 'Towed', label: 'Towed' },
  { value: 'Driven', label: 'Driven' },
  { value: 'Carried', label: 'Carried' },
];

export type TyreType = 'Inflatable' | 'Tubeless' | '';

export const TYRE_TYPE_OPTIONS: { value: TyreType; label: string }[] = [
  { value: '', label: 'Select type' },
  { value: 'Inflatable', label: 'Inflatable' },
  { value: 'Tubeless', label: 'Tubeless' },
];

export const FUEL_TYPES = ['Petrol', 'Diesel', 'Hybrid', 'Electric', 'LPG', 'Other'];

export const CONDITION_ITEMS = [
  'Ignition',
  'Transmission',
  'Handling',
  'Suspension',
  'Chassis',
  'Engine',
  'Handbrake',
  'Footbrake',
  'Tyres',
  'Headlights/Indicators/Hazard',
  'Side Mirrors',
  'Windscreens',
  'Bumpers',
  'Boot Lid/Tailgate',
  'Doors/Locks',
  'Body Panels/Paintwork',
  'Interior/Upholstery',
  'AC System',
  'Alarm Device',
  'Airbags',
] as const;

export type ConditionItemKey = (typeof CONDITION_ITEMS)[number];

export type DocumentType =
  | 'claim_form'
  | 'police_abstract'
  | 'logbook'
  | 'driver_statement'
  | 'repair_quotation';

export interface DocumentChecklistItem {
  received: boolean;
  notes: string;
}

export interface VehicleDiagramMark {
  id: string;
  x: number;
  y: number;
  /** Impact direction in degrees (0 = right, 90 = down). */
  angle: number;
  zone?: string;
}

export interface DatasheetFormData {
  header: {
    formTypes: FormType[];
    date: string;
    time: string;
  };
  basicInfo: {
    documentsProvided: string;
    clientInsurer: string;
    ownerInsured: string;
    instructedBy: string;
    policyNo: string;
    claimNo: string;
    dateOfAccident: string;
    regNo: string;
    make: string;
    modelNo: string;
    year: string;
    firstRegistered: string;
    chassisNo: string;
    engineNo: string;
    sumInsured: string;
    excess: string;
  };
  assessment: {
    origin: string;
    bodyType: string;
    colour: string;
    mileage: string;
    engineCC: string;
    fuelType: string;
    tyreBrand: string;
    tyreSize: string;
    tyreType: TyreType;
  };
  vehicleCondition: Record<ConditionItemKey, string>;
  damage: {
    damageSummary: string;
    preAccidentDefects: string;
    vehicleDiagram: VehicleDiagramMark[];
    garageArrival: GarageArrival;
  };
  advice: {
    adviceToRepairer: string;
    adviceToInsurer: string;
  };
  documents: Record<DocumentType, DocumentChecklistItem>;
  signOff: {
    repairerContactPerson: string;
    repairerPhone: string;
    seenBy: string;
    signatureDateTime: string;
    assessorSignature: string;
  };
}

export const DOCUMENT_CHECKLIST: {
  key: DocumentType;
  label: string;
}[] = [
  { key: 'claim_form', label: 'Claim Form' },
  { key: 'police_abstract', label: 'Police Abstract' },
  { key: 'logbook', label: 'Logbook Copy' },
  { key: 'driver_statement', label: "Driver's Statement" },
  { key: 'repair_quotation', label: 'Repair Quotation' },
];

export const FORM_SECTIONS = [
  { id: 'header', title: 'Header & Claim Details', number: 1 },
  { id: 'vehicle', title: 'Vehicle & Financials', number: 2 },
  { id: 'assessment', title: 'Assessment & Tyres', number: 3 },
  { id: 'condition', title: 'Vehicle Condition', number: 4 },
  { id: 'damage', title: 'Damage & Transport', number: 5 },
  { id: 'advice', title: 'Advice, Documents & Sign-off', number: 6 },
] as const;

function createConditionDefaults(): Record<ConditionItemKey, string> {
  return Object.fromEntries(CONDITION_ITEMS.map((item) => [item, ''])) as Record<
    ConditionItemKey,
    string
  >;
}

function createDocumentDefaults(): Record<DocumentType, DocumentChecklistItem> {
  return {
    claim_form: { received: false, notes: '' },
    police_abstract: { received: false, notes: '' },
    logbook: { received: false, notes: '' },
    driver_statement: { received: false, notes: '' },
    repair_quotation: { received: false, notes: '' },
  };
}

export function createDefaultFormData(): DatasheetFormData {
  const now = new Date();
  return {
    header: {
      formTypes: ['Assessment'],
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().slice(0, 5),
    },
    basicInfo: {
      documentsProvided: '',
      clientInsurer: '',
      ownerInsured: '',
      instructedBy: '',
      policyNo: '',
      claimNo: '',
      dateOfAccident: '',
      regNo: '',
      make: '',
      modelNo: '',
      year: '',
      firstRegistered: '',
      chassisNo: '',
      engineNo: '',
      sumInsured: '',
      excess: '',
    },
    assessment: {
      origin: '',
      bodyType: '',
      colour: '',
      mileage: '',
      engineCC: '',
      fuelType: '',
      tyreBrand: '',
      tyreSize: '',
      tyreType: '',
    },
    vehicleCondition: createConditionDefaults(),
    damage: {
      damageSummary: '',
      preAccidentDefects: '',
      vehicleDiagram: [],
      garageArrival: '',
    },
    advice: {
      adviceToRepairer: '',
      adviceToInsurer: '',
    },
    documents: createDocumentDefaults(),
    signOff: {
      repairerContactPerson: '',
      repairerPhone: '',
      seenBy: '',
      signatureDateTime: '',
      assessorSignature: '',
    },
  };
}

export function countReceivedDocuments(documents: Record<DocumentType, DocumentChecklistItem>): {
  received: number;
  total: number;
} {
  const total = DOCUMENT_CHECKLIST.length;
  const received = DOCUMENT_CHECKLIST.filter((d) => documents[d.key].received).length;
  return { received, total };
}

export function conditionItemKey(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
}
