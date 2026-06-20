import type { Path } from 'react-hook-form';
import type { DatasheetFormData } from '@/types/datasheet';
import type { InspectionFormData } from '../types/inspection';
import { itemKey } from '../types/inspection';

export function inspectionPath(path: Path<InspectionFormData>): Path<DatasheetFormData> {
  return `inspection.${path}` as Path<DatasheetFormData>;
}

export function inspectionItemPath(
  sectionKey: 'mechanical' | 'electrical' | 'technical' | 'coachwork' | 'bodyCondition',
  itemLabel: string,
  field: 'rating' | 'remarks',
): Path<DatasheetFormData> {
  return `inspection.${sectionKey}.${itemKey(itemLabel)}.${field}` as Path<DatasheetFormData>;
}
