import { UseFormRegister } from 'react-hook-form';
import { DatasheetFormData } from '@/types/datasheet';
import { CONDITION_RATINGS, ConditionRating } from '../types/inspection';
import { inspectionItemPath } from '../utils/formPaths';

interface ConditionRatingTableProps {
  items: readonly string[];
  sectionKey: 'mechanical' | 'electrical' | 'technical' | 'coachwork' | 'bodyCondition';
  register: UseFormRegister<DatasheetFormData>;
}

export function ConditionRatingTable({
  items,
  sectionKey,
  register,
}: ConditionRatingTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead>
          <tr className="bg-brand-700 text-white">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Inspection Item</th>
            <th className="w-40 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide">Condition</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Remarks</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {items.map((item, index) => {
            const ratingPath = inspectionItemPath(sectionKey, item, 'rating');
            const remarksPath = inspectionItemPath(sectionKey, item, 'remarks');

            return (
              <tr key={item} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                <td className="px-4 py-3 font-medium text-slate-800">{item}</td>
                <td className="px-3 py-2">
                  <select
                    {...register(ratingPath)}
                    className="form-input w-full text-center text-sm"
                  >
                    {CONDITION_RATINGS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    {...register(remarksPath)}
                    placeholder="Optional"
                    className="form-input w-full"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function RatingBadge({ rating }: { rating: ConditionRating }) {
  if (!rating) return <span className="text-slate-400">—</span>;

  const classes: Record<string, string> = {
    excellent: 'rating-excellent',
    good: 'rating-good',
    fair: 'rating-fair',
    poor: 'rating-poor',
    na: 'rating-na',
  };

  return (
    <span
      className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${rating === 'na' ? '' : 'capitalize'} ${classes[rating]}`}
    >
      {rating === 'na' ? 'N/A' : rating}
    </span>
  );
}
