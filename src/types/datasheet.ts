export type DatasheetStatus = 'draft' | 'submitted' | 'under_review' | 'approved';

export const DATASHEET_STATUSES: DatasheetStatus[] = [
  'draft',
  'submitted',
  'under_review',
  'approved',
];

export type UserRole = 'Admin' | 'PrincipalOfficer' | 'OperationsManager' | 'Assessor';

export const USER_ROLES: UserRole[] = [
  'Admin',
  'PrincipalOfficer',
  'OperationsManager',
  'Assessor',
];

export const ROLE_LABELS: Record<UserRole, string> = {
  Admin: 'Admin',
  PrincipalOfficer: 'Principal Officer',
  OperationsManager: 'Operations Manager',
  Assessor: 'Assessor',
};

export type FormType =
  | 'Assessment'
  | 'Re-inspection'
  | 'Supplementary'
  | 'Technical'
  | 'Inspection';

export const FORM_TYPES: FormType[] = [
  'Assessment',
  'Re-inspection',
  'Supplementary',
  'Technical',
  'Inspection',
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

export const DASHBOARD_WARNING_LIGHTS = [
  { key: 'checkEngine', label: 'Check Engine / MIL' },
  { key: 'abs', label: 'ABS' },
  { key: 'airbag', label: 'Airbag / SRS' },
  { key: 'battery', label: 'Battery / Charging' },
  { key: 'oilPressure', label: 'Oil Pressure' },
  { key: 'coolant', label: 'Coolant / Temperature' },
  { key: 'brake', label: 'Brake System' },
  { key: 'handbrake', label: 'Handbrake' },
  { key: 'tpms', label: 'TPMS' },
  { key: 'tractionControl', label: 'Traction Control / ESP' },
  { key: 'glowPlug', label: 'Glow Plug (Diesel)' },
  { key: 'dpf', label: 'DPF / Emissions' },
  { key: 'service', label: 'Service / Maintenance' },
  { key: 'noneObserved', label: 'None Observed' },
] as const;

export type DashboardWarningLightKey = (typeof DASHBOARD_WARNING_LIGHTS)[number]['key'];

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

import type { InspectionFormData } from '@/inspection/types/inspection';
import { createDefaultFormData as createDefaultInspectionData } from '@/inspection/types/inspection';

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
    dashboardWarningLights: Record<DashboardWarningLightKey, boolean>;
    dashboardWarningLightsNotes: string;
  };
  vehicleCondition: Record<ConditionItemKey, string>;
  damage: {
    damageSummary: string;
    preAccidentDefects: string;
    vehicleDiagram: VehicleDiagramMark[];
    garageArrival: GarageArrival;
  };
  parts: {
    toBeReplaced: string;
    toBePainted: string;
    toBeRepaired: string;
  };
  remarks: string;
  documents: Record<DocumentType, DocumentChecklistItem>;
  signOff: {
    repairerContactPerson: string;
    repairerPhone: string;
    seenBy: string;
    signatureDateTime: string;
    assessorSignature: string;
  };
  inspection?: InspectionFormData;
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
  { id: 'advice', title: 'Remarks, Documents & Sign-off', number: 6 },
] as const;

function createDashboardWarningLightsDefaults(): Record<DashboardWarningLightKey, boolean> {
  return Object.fromEntries(
    DASHBOARD_WARNING_LIGHTS.map((light) => [light.key, false]),
  ) as Record<DashboardWarningLightKey, boolean>;
}

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

export function createDefaultFormData(seenByName = ''): DatasheetFormData {
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
      dashboardWarningLights: createDashboardWarningLightsDefaults(),
      dashboardWarningLightsNotes: '',
    },
    vehicleCondition: createConditionDefaults(),
    damage: {
      damageSummary: '',
      preAccidentDefects: '',
      vehicleDiagram: [],
      garageArrival: '',
    },
    parts: {
      toBeReplaced: '',
      toBePainted: '',
      toBeRepaired: '',
    },
    remarks: '',
    documents: createDocumentDefaults(),
    signOff: {
      repairerContactPerson: '',
      repairerPhone: '',
      seenBy: seenByName,
      signatureDateTime: '',
      assessorSignature: '',
    },
    inspection: undefined,
  };
}

export function createDefaultInspectionFormData(inspectorName = ''): InspectionFormData {
  const data = createDefaultInspectionData();
  if (inspectorName) {
    data.vehicleDetails.inspectorName = inspectorName;
  }
  return data;
}

export function isInspectionOnlyForm(formTypes: FormType[]): boolean {
  return formTypes.length === 1 && formTypes[0] === 'Inspection';
}

export function hasInspectionForm(formTypes: FormType[]): boolean {
  return formTypes.includes('Inspection');
}

export function countReceivedDocuments(documents: Record<DocumentType, DocumentChecklistItem>): {
  received: number;
  total: number;
} {
  const total = DOCUMENT_CHECKLIST.length;
  const received = DOCUMENT_CHECKLIST.filter((d) => documents[d.key].received).length;
  return { received, total };
}

export function mergeFormData(
  loaded: Partial<DatasheetFormData> & {
    advice?: { adviceToRepairer?: string; adviceToInsurer?: string };
  },
): DatasheetFormData {
  const defaults = createDefaultFormData();
  const legacyRemarks = [loaded.advice?.adviceToRepairer, loaded.advice?.adviceToInsurer]
    .filter(Boolean)
    .join('\n\n');

  return {
    ...defaults,
    ...loaded,
    parts: { ...defaults.parts, ...loaded.parts },
    assessment: {
      ...defaults.assessment,
      ...loaded.assessment,
      dashboardWarningLights: {
        ...defaults.assessment.dashboardWarningLights,
        ...loaded.assessment?.dashboardWarningLights,
      },
    },
    documents: { ...defaults.documents, ...loaded.documents },
    inspection: loaded.inspection ?? defaults.inspection,
    remarks: loaded.remarks ?? legacyRemarks ?? defaults.remarks,
  };
}
