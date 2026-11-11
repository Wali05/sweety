import { useId, useState } from 'react';
import { MESSAGES, sortBySlot, todayLocal } from '../readings/slots.js';
import MonthSection from '../reports/MonthSection.jsx';
import { formatRange } from '../reports/formatRange.js';
import { useMonthReadings } from '../reports/useMonthReadings.js';
import { useReports } from '../reports/useReports.js';
import Alert from '../ui/Alert.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import Loading from '../ui/Loading.jsx';

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
    <section className="card report" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{title}</h2>
      <p className="report-range">{formatRange(report.from, report.to)}</p>
      {report.empty ? (
        <EmptyState>{report.message || EMPTY_MESSAGE}</EmptyState>
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
  // For the chart, loaded alongside the reports.
  const month = useMonthReadings(dateProblem ? null : date);

  let content;
  if (dateProblem) {
    content = <EmptyState id="reports-date-problem">{dateProblem}</EmptyState>;
  } else if (error) {
    content = <Alert title="Your reports could not be loaded.">{error}</Alert>;
  } else if (!reports) {
    content = <Loading>Loading reports…</Loading>;
  } else {
    content = (
      <>
        {/* Side by side on wide screens, stacked on narrow ones. */}
        <div className="report-grid">
          <ReportSection title="Daily" report={reports.daily} />
          <ReportSection title="Month-to-date" report={reports.monthToDate} />
          <ReportSection title="Previous month" report={reports.previousMonth} />
        </div>
        <MonthSection date={date} readings={month.readings} error={month.error} />
      </>
    );
  }

  // Ties the date field to the message that says what is wrong with it.
  const dateProblemProps = dateProblem
    ? { 'aria-invalid': true, 'aria-describedby': 'reports-date-problem' }
    : {};

  return (
    <section>
      <div className="page-header">
        <h1>Reports</h1>
        <p className="lead">
          Summaries for the day you pick, its month so far and the month before.
        </p>
      </div>
      <div className="toolbar">
        <div className="field field-inline">
          <label htmlFor="reports-date">Date</label>
          <input
            id="reports-date"
            name="date"
            type="date"
            max={today}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            {...dateProblemProps}
          />
        </div>
      </div>
      {content}
    </section>
  );
}
