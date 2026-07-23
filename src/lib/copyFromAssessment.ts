import {
  createDefaultFormData,
  mergeFormData,
  type DatasheetFormData,
  type FormType,
} from '@/types/datasheet';

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function nowTime(): string {
  return new Date().toTimeString().slice(0, 5);
}

/** Static vehicle / claim identity copied from a prior Assessment. */
function copyIdentity(source: DatasheetFormData): Pick<
  DatasheetFormData,
  'basicInfo' | 'assessment'
> {
  return {
    basicInfo: {
      ...source.basicInfo,
      // Fresh instruction date for the follow-up visit
      dateOfInstruction: todayIso(),
      instructedBy: source.basicInfo.instructedBy || '',
      documentsProvided: '',
    },
    assessment: {
      ...source.assessment,
      // Re-check on site
      mileage: '',
      dashboardWarningLights: createDefaultFormData().assessment.dashboardWarningLights,
      dashboardWarningLightsNotes: '',
    },
  };
}

function freshSignOff(seenBy = ''): DatasheetFormData['signOff'] {
  return {
    repairerContactPerson: '',
    repairerPhone: '',
    seenBy,
    signatureDateTime: '',
    assessorSignature: '',
    reviewedBy: '',
    reviewedAt: '',
  };
}

function freshDocuments(): DatasheetFormData['documents'] {
  return createDefaultFormData().documents;
}

/**
 * Re-inspection: post-repair observations.
 * Copies claim + vehicle identity; leaves damage/parts/condition for fresh post-repair notes.
 */
export function buildReinspectionFrom(
  source: DatasheetFormData,
  opts?: { sourceSerial?: string; seenBy?: string },
): DatasheetFormData {
  const identity = copyIdentity(source);
  const priorDamage = source.damage.damageSummary?.trim();
  const remarksParts = [
    opts?.sourceSerial ? `Follow-up Re-inspection of Assessment ${opts.sourceSerial}.` : null,
    priorDamage ? `Original damage (from Assessment):\n${priorDamage}` : null,
    'Post-repair observations:',
  ].filter(Boolean);

  return mergeFormData({
    header: {
      formTypes: ['Re-inspection'],
      date: todayIso(),
      time: nowTime(),
    },
    ...identity,
    vehicleCondition: createDefaultFormData().vehicleCondition,
    damage: {
      damageSummary: '',
      preAccidentDefects: source.damage.preAccidentDefects || '',
      vehicleDiagram: [],
      garageArrival: source.damage.garageArrival || '',
    },
    parts: {
      toBeReplaced: '',
      toBePainted: '',
      toBeRepaired: '',
    },
    remarks: remarksParts.join('\n\n'),
    documents: freshDocuments(),
    signOff: freshSignOff(opts?.seenBy),
    inspection: undefined,
  });
}

/**
 * Supplementary: additional or missed items / repairs.
 * Copies identity + prior damage context and prior parts list so assessor can add missed lines.
 */
export function buildSupplementaryFrom(
  source: DatasheetFormData,
  opts?: { sourceSerial?: string; seenBy?: string },
): DatasheetFormData {
  const identity = copyIdentity(source);
  const remarksParts = [
    opts?.sourceSerial ? `Supplementary to Assessment ${opts.sourceSerial}.` : null,
    source.damage.damageSummary?.trim()
      ? `Prior damage summary:\n${source.damage.damageSummary.trim()}`
      : null,
    'Additional / missed items or repairs:',
  ].filter(Boolean);

  return mergeFormData({
    header: {
      formTypes: ['Supplementary'],
      date: todayIso(),
      time: nowTime(),
    },
    ...identity,
    vehicleCondition: createDefaultFormData().vehicleCondition,
    damage: {
      damageSummary: '',
      preAccidentDefects: source.damage.preAccidentDefects || '',
      vehicleDiagram: source.damage.vehicleDiagram?.length
        ? [...source.damage.vehicleDiagram]
        : [],
      garageArrival: source.damage.garageArrival || '',
    },
    // Keep prior parts as a starting point — assessor adds missed items
    parts: {
      toBeReplaced: source.parts.toBeReplaced || '',
      toBePainted: source.parts.toBePainted || '',
      toBeRepaired: source.parts.toBeRepaired || '',
    },
    remarks: remarksParts.join('\n\n'),
    documents: freshDocuments(),
    signOff: freshSignOff(opts?.seenBy),
    inspection: undefined,
  });
}

/** Pre-theft: stolen vehicle — claim/vehicle identity only when known; no repair fields. */
export function buildPretheftFrom(
  source?: DatasheetFormData | null,
  opts?: { sourceSerial?: string; seenBy?: string },
): DatasheetFormData {
  const base = createDefaultFormData(opts?.seenBy);
  if (!source) {
    return mergeFormData({
      ...base,
      header: { formTypes: ['Pre-theft'], date: todayIso(), time: nowTime() },
      remarks: 'Subject vehicle reported stolen.',
      damage: {
        ...base.damage,
        damageSummary: 'Vehicle stolen — not available for inspection.',
        garageArrival: '',
      },
    });
  }

  return mergeFormData({
    header: { formTypes: ['Pre-theft'], date: todayIso(), time: nowTime() },
    basicInfo: {
      ...source.basicInfo,
      dateOfInstruction: todayIso(),
      documentsProvided: '',
    },
    assessment: {
      ...source.assessment,
      mileage: '',
      dashboardWarningLights: base.assessment.dashboardWarningLights,
      dashboardWarningLightsNotes: '',
    },
    vehicleCondition: base.vehicleCondition,
    damage: {
      damageSummary: 'Vehicle stolen — not available for inspection.',
      preAccidentDefects: '',
      vehicleDiagram: [],
      garageArrival: '',
    },
    parts: base.parts,
    remarks: [
      opts?.sourceSerial ? `Pre-theft file linked to ${opts.sourceSerial}.` : null,
      'Subject vehicle reported stolen. Record circumstances, police report, and available keys/remotes.',
    ]
      .filter(Boolean)
      .join('\n\n'),
    documents: freshDocuments(),
    signOff: freshSignOff(opts?.seenBy),
    inspection: undefined,
  });
}

export function buildFollowUpFromAssessment(
  source: DatasheetFormData,
  formType: Extract<FormType, 'Re-inspection' | 'Supplementary' | 'Pre-theft'>,
  opts?: { sourceSerial?: string; seenBy?: string },
): DatasheetFormData {
  if (formType === 'Re-inspection') return buildReinspectionFrom(source, opts);
  if (formType === 'Supplementary') return buildSupplementaryFrom(source, opts);
  return buildPretheftFrom(source, opts);
}

/** True if form_types CSV / array indicates an Assessment. */
export function formTypesIncludeAssessment(formTypes: string | string[] | null | undefined): boolean {
  if (!formTypes) return false;
  const list = Array.isArray(formTypes) ? formTypes : formTypes.split(/[,|]/);
  return list.some((t) => t.trim().toLowerCase() === 'assessment');
}
