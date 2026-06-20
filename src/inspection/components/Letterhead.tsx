import { COMPANY, LOGO_MARK_PATH } from '../constants/brand';

interface LetterheadProps {
  variant?: 'app' | 'report';
  reportId?: string;
  reportDate?: string;
  reportTime?: string;
  documentTitle?: string;
}

export function Letterhead({
  variant = 'app',
  reportId,
  reportDate,
  reportTime,
  documentTitle = COMPANY.reportTitle,
}: LetterheadProps) {
  const isReport = variant === 'report';

  return (
    <header className={isReport ? 'letterhead letterhead-report' : 'letterhead letterhead-app'}>
      <div className="letterhead-top-row">
        <div className="letterhead-brand-block">
          <img src={LOGO_MARK_PATH} alt={COMPANY.shortName} className="letterhead-mark" />
          <p className="letterhead-company-name">{COMPANY.name}</p>
          <div className="letterhead-contacts-block">
            <p>{COMPANY.contactAddressLine}</p>
            <p>{COMPANY.contactDetailsLine}</p>
          </div>
        </div>

        {isReport && (reportId || reportDate) && (
          <div className="letterhead-report-meta">
            {reportId && (
              <div>
                <span className="letterhead-meta-label">Report ID</span>
                <span className="letterhead-meta-value">{reportId}</span>
              </div>
            )}
            {reportDate && (
              <div>
                <span className="letterhead-meta-label">Date</span>
                <span className="letterhead-meta-value">{reportDate}</span>
              </div>
            )}
            {reportTime && (
              <div>
                <span className="letterhead-meta-label">Time</span>
                <span className="letterhead-meta-value">{reportTime}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="letterhead-doc-title">{documentTitle.toUpperCase()}</p>

      <div className="letterhead-rule" aria-hidden="true" />
    </header>
  );
}

export function LetterheadFooter() {
  return (
    <footer className="letterhead-footer">
      <div className="letterhead-footer-rule" aria-hidden="true" />
      <p className="letterhead-footer-name">{COMPANY.name}</p>
      <p className="letterhead-footer-contact">
        {COMPANY.contactAddressLine} · {COMPANY.contactDetailsLine}
      </p>
      <p className="letterhead-footer-note">Confidential — This document is intended solely for the parties named herein.</p>
    </footer>
  );
}
