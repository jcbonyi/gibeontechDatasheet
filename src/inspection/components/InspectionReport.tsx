import { InspectionFormData } from '../types/inspection';
import {
  SYSTEMS_INSPECTION_GROUPS,
  COACHWORK_ITEMS,
  BODY_ITEMS,
  PHOTO_FIELDS,
  BODY_DAMAGE_LABELS,
  InspectionItem,
  ConditionRating,
  getInspectionItem,
} from '../types/inspection';
import { CheckCircle2, XCircle, ShieldAlert } from 'lucide-react';
import { Letterhead, LetterheadFooter } from './Letterhead';

interface InspectionReportProps {
  data: InspectionFormData;
}

function RatingPill({ rating }: { rating: ConditionRating }) {
  if (!rating) return <span className="report-muted">—</span>;
  const styles: Record<string, string> = {
    excellent: 'report-rating-excellent',
    good: 'report-rating-good',
    fair: 'report-rating-fair',
    poor: 'report-rating-poor',
    na: 'report-rating-na',
  };
  return <span className={`report-rating ${styles[rating]}`}>{rating === 'na' ? 'N/A' : rating}</span>;
}

function ReportTable({
  title,
  items,
  sectionData,
  remarks,
}: {
  title: string;
  items: readonly string[];
  sectionData: Record<string, InspectionItem>;
  remarks?: string;
}) {
  const ratedItems = items.filter((item) => getInspectionItem(sectionData, item)?.rating);
  if (ratedItems.length === 0 && !remarks) return null;

  return (
    <div className="report-section">
      <h3 className="report-section-title">{title}</h3>
      <table className="report-table">
        <thead>
          <tr>
            <th>Item</th>
            <th className="w-28 text-center">Rating</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const entry = getInspectionItem(sectionData, item);
            return (
              <tr key={item}>
                <td>{item}</td>
                <td className="text-center"><RatingPill rating={entry?.rating ?? ''} /></td>
                <td className="report-muted">{entry?.remarks || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {remarks && <p className="report-remarks"><strong>Remarks:</strong> {remarks}</p>}
    </div>
  );
}

function VerdictBadge({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  const isYes = value === 'yes';
  return (
    <div className={`report-verdict ${isYes ? (positive ? 'report-verdict-pass' : 'report-verdict-warn') : 'report-verdict-fail'}`}>
      <span className="report-verdict-label">{label}</span>
      <span className="report-verdict-value">{isYes ? 'Yes' : 'No'}</span>
    </div>
  );
}

export function InspectionReport({ data }: InspectionReportProps) {
  const vd = data.vehicleDetails;
  const reportId = `MVI-${vd.registrationNumber.replace(/\s/g, '')}-${vd.inspectionDate.replace(/-/g, '')}`;
  const isRoadworthy = data.findings.roadworthy === 'yes';

  const damageEntries = Object.entries(data.bodyDamage).filter(([, v]) => v);

  return (
    <div id="inspection-report" className="report-document">
      <Letterhead
        variant="report"
        reportId={reportId}
        reportDate={vd.inspectionDate}
        reportTime={vd.inspectionTime}
      />

      {/* Executive Summary */}
      <div className={`report-summary ${isRoadworthy ? 'report-summary-pass' : 'report-summary-fail'}`}>
        <div className="report-summary-main">
          {isRoadworthy ? (
            <CheckCircle2 className="h-8 w-8 shrink-0" />
          ) : (
            <XCircle className="h-8 w-8 shrink-0" />
          )}
          <div>
            <p className="report-summary-status">
              {isRoadworthy ? 'Vehicle Declared Roadworthy' : 'Vehicle Not Roadworthy'}
            </p>
            <p className="report-summary-vehicle">
              {vd.yearOfManufacture} {vd.make} {vd.model} · {vd.registrationNumber}
            </p>
          </div>
        </div>
        <div className="report-summary-details">
          <div>
            <span className="report-meta-label">Overall Condition</span>
            <RatingPill rating={data.generalCondition.rating} />
          </div>
          <div>
            <span className="report-meta-label">Odometer</span>
            <span className="font-semibold">{Number(vd.odometerReading).toLocaleString()} KM</span>
          </div>
          <div>
            <span className="report-meta-label">Inspector</span>
            <span className="font-semibold">{vd.inspectorName}</span>
          </div>
        </div>
      </div>

      {/* Vehicle Details */}
      <div className="report-section">
        <h2 className="report-heading">Vehicle & Owner Details</h2>
        <div className="report-detail-grid">
          {[
            ['Registration', vd.registrationNumber],
            ['Make / Model', `${vd.make} ${vd.model}`],
            ['Year', vd.yearOfManufacture],
            ['Engine No.', vd.engineNumber],
            ['Engine CC', vd.engineCC ? `${vd.engineCC} cc` : '—'],
            ['Chassis / VIN', vd.chassisVin],
            ['Fuel Type', vd.fuelType],
            ['Color', vd.vehicleColor],
            ['Seating', vd.seatingCapacity],
            ['Usage', vd.vehicleUsage],
            ['Owner', vd.ownerName],
            ['Contact', vd.ownerContact],
            ['Insurance', vd.insuranceCompany || '—'],
            ['Policy No.', vd.policyNumber || '—'],
            ['Location', vd.inspectionLocation],
          ].map(([label, value]) => (
            <div key={label as string} className="report-detail-item">
              <span className="report-detail-label">{label}</span>
              <span className="report-detail-value">{value}</span>
            </div>
          ))}
        </div>
        {data.generalCondition.comments && (
          <p className="report-remarks mt-3">
            <strong>Overall Comments:</strong> {data.generalCondition.comments}
          </p>
        )}
      </div>

      {/* Systems Inspection */}
      <div className="report-section report-page-break">
        <h2 className="report-heading">Systems Inspection</h2>
        {SYSTEMS_INSPECTION_GROUPS.map((group) => (
          <ReportTable
            key={group.id}
            title={group.label}
            items={group.items}
            sectionData={data[group.dataKey]}
            remarks={data[group.remarksKey]}
          />
        ))}
      </div>

      {/* Exterior & Interior */}
      <div className="report-section report-page-break">
        <h2 className="report-heading">Exterior & Interior Condition</h2>
        <ReportTable title="Interior & Upholstery" items={COACHWORK_ITEMS} sectionData={data.coachwork} remarks={data.coachworkRemarks} />
        <ReportTable title="Body Panels" items={BODY_ITEMS} sectionData={data.bodyCondition} remarks={data.bodyRemarks} />
        {damageEntries.length > 0 && (
          <div className="mt-4">
            <h3 className="report-section-title">Damage Assessment</h3>
            <div className="report-damage-grid">
              {damageEntries.map(([key, value]) => (
                <div key={key} className="report-damage-item">
                  <span className="report-detail-label">{BODY_DAMAGE_LABELS[key as keyof typeof BODY_DAMAGE_LABELS]}</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Findings */}
      <div className="report-section">
        <h2 className="report-heading">Assessment & Conclusion</h2>
        <div className="report-verdict-grid">
          <VerdictBadge label="Roadworthy" value={data.findings.roadworthy} positive />
          <VerdictBadge label="Pre-existing Damage" value={data.findings.preExistingDamage} />
          <VerdictBadge label="Repairs Recommended" value={data.findings.repairsRecommended} />
        </div>
        {data.findings.estimatedRepairCost && (
          <p className="report-cost">
            <ShieldAlert className="inline h-4 w-4" />
            Estimated Repair Cost: <strong>{data.findings.estimatedRepairCost}</strong>
          </p>
        )}
        {data.findings.additionalObservations && (
          <p className="report-remarks"><strong>Additional Observations:</strong> {data.findings.additionalObservations}</p>
        )}
      </div>

      {/* Photos */}
      <div className="report-section report-page-break">
        <h2 className="report-heading">Photographic Evidence</h2>
        <div className="report-photo-grid">
          {PHOTO_FIELDS.filter(({ key }) => data.photos[key]).map(({ key, label }) => (
            <figure key={key} className="report-photo">
              <img src={data.photos[key]} alt={label} />
              <figcaption>{label}</figcaption>
            </figure>
          ))}
        </div>
      </div>

      {/* Declaration */}
      <div className="report-section report-declaration">
        <h2 className="report-heading">Declaration & Sign-off</h2>
        <p className="report-declaration-text">
          I certify that the above inspection was conducted physically and the findings recorded represent the condition of the vehicle at the time of inspection.
        </p>
        <div className="report-signature-grid">
          <div className="report-signature-block">
            <p className="report-signature-role">Inspector</p>
            <p className="report-signature-name">{vd.inspectorName}</p>
            <div className="report-signature-line">{data.declaration.inspectorSignature}</div>
            <p className="report-signature-date">Date: {data.declaration.inspectorDate}</p>
          </div>
          <div className="report-signature-block">
            <p className="report-signature-role">Owner / Representative</p>
            <p className="report-signature-name">{vd.ownerName}</p>
            <div className="report-signature-line">{data.declaration.ownerSignature}</div>
            <p className="report-signature-date">Date: {data.declaration.ownerDate}</p>
          </div>
        </div>
      </div>

      <LetterheadFooter />
    </div>
  );
}
