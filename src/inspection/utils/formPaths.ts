import type { Path } from 'react-hook-form';
import type { DatasheetFormData } from '@/types/datasheet';
import type { InspectionFormData } from '../types/inspection';

export function inspectionPath(path: Path<InspectionFormData>): Path<DatasheetFormData> {
  return `inspection.${path}` as Path<DatasheetFormData>;
}

export function inspectionItemPath(
  sectionKey: 'mechanical' | 'electrical' | 'technical' | 'coachwork' | 'bodyCondition',
  item: string,
  field: 'rating' | 'remarks',
): Path<DatasheetFormData> {
  const escaped = item.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `inspection.${sectionKey}["${escaped}"].${field}` as Path<DatasheetFormData>;
}
