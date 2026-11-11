import { useId, useState } from 'react';
import { MESSAGES, sortBySlot, todayLocal } from '../readings/slots.js';
import { formatRange } from '../reports/formatRange.js';
import { useReports } from '../reports/useReports.js';

// Shown if a report without readings comes with no message of its own.
const EMPTY_MESSAGE = 'No readings for this period yet.';

function Stat({ label, value, unit = true }) {
  return (
    <div className="report-stat">
      <dt>{label}</dt>
      <dd>
        {value}
        {unit && <span className="reading-unit"> mg/dl</span>}
      </dd>
    </div>
  );
}

// One report: its date range, then the summary numbers or the empty state.
// A report with a readings list (the daily one) also shows it.
function ReportSection({ title, report }) {
  const id = useId();

  return (
    <section className="report" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{title}</h2>
      <p className="report-range">{formatRange(report.from, report.to)}</p>
      {report.empty ? (
        <p className="empty">{report.message || EMPTY_MESSAGE}</p>
      ) : (
        <>
          <dl className="report-stats">
            <Stat label="Highest" value={report.highest} />
            <Stat label="Lowest" value={report.lowest} />
            {/* Always 1 decimal: JSON turns an average of 140.0 into 140. */}
            <Stat label="Average" value={report.average.toFixed(1)} />
            <Stat label="Readings" value={report.count} unit={false} />
          </dl>
          {report.readings && (
            <ul className="reading-list">
              {sortBySlot(report.readings).map((reading) => (
                <li key={reading.id}>
                  <span className="reading-slot">{reading.slotLabel}</span>
                  <span className="reading-value">
                    {reading.value} <span className="reading-unit">mg/dl</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

export default function Reports() {
  const today = todayLocal();
  const [date, setDate] = useState(today);

  // The date input's value is '' while it is empty or only partly filled in.
  let dateProblem = null;
  if (!date) dateProblem = MESSAGES.dateRequired;
  else if (date > today) dateProblem = MESSAGES.dateInFuture;

  const { reports, error } = useReports(dateProblem ? null : date);

  let content;
  if (dateProblem) {
    content = <p className="empty">{dateProblem}</p>;
  } else if (error) {
    content = (
      <p className="alert alert-error" role="alert">
        {error}
      </p>
    );
  } else if (!reports) {
    content = (
      <p className="loading" role="status">
        Loading reports…
      </p>
    );
  } else {
    content = (
      <>
        <ReportSection title="Daily" report={reports.daily} />
        <ReportSection title="Month-to-date" report={reports.monthToDate} />
        <ReportSection title="Previous month" report={reports.previousMonth} />
      </>
    );
  }

  return (
    <section className="reports">
      <h1>Reports</h1>
      <div className="field reports-date">
        <label htmlFor="reports-date">Date</label>
        <input
          id="reports-date"
          name="date"
          type="date"
          max={today}
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>
      {content}
    </section>
  );
}
