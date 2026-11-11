import { useState } from 'react';
import { createReading } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import ReadingForm from '../readings/ReadingForm.jsx';
import {
  MAX_READINGS_PER_DAY,
  MESSAGES,
  slotLabel,
  sortBySlot,
  todayLocal,
} from '../readings/slots.js';
import { useDayReadings } from '../readings/useDayReadings.js';

export default function Readings() {
  const { token } = useAuth();
  const today = todayLocal();

  const [date, setDate] = useState(today);

  // The date input's value is '' while it is empty or only partly filled in.
  let dateProblem = null;
  if (!date) dateProblem = MESSAGES.dateRequired;
  else if (date > today) dateProblem = MESSAGES.dateInFuture;

  const { readings, error, reload } = useDayReadings(dateProblem ? null : date);

  // Show the saved reading's date, with the list fetched again.
  function handleSaved(reading) {
    setDate(reading.date);
    reload();
  }

  let content;
  if (dateProblem) {
    content = <p className="empty">{dateProblem}</p>;
  } else if (error) {
    content = (
      <p className="alert alert-error" role="alert">
        {error}
      </p>
    );
  } else if (!readings) {
    content = (
      <p className="loading" role="status">
        Loading readings…
      </p>
    );
  } else {
    const sorted = sortBySlot(readings);
    content = (
      <>
        <p className="reading-count">{`${sorted.length} of ${MAX_READINGS_PER_DAY} readings`}</p>
        {sorted.length === 0 ? (
          <p className="empty">No readings for this date yet.</p>
        ) : (
          <ul className="reading-list">
            {sorted.map((reading) => (
              <li key={reading.id}>
                <span className="reading-slot">{slotLabel(reading.slot)}</span>
                <span className="reading-value">
                  {reading.value} <span className="reading-unit">mg/dl</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  return (
    <section className="readings">
      <h1>Readings</h1>
      <div className="field readings-date">
        <label htmlFor="readings-date">Date</label>
        <input
          id="readings-date"
          name="date"
          type="date"
          max={today}
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>
      {content}
      <section className="add-reading" aria-labelledby="add-reading-heading">
        <h2 id="add-reading-heading">Add a reading</h2>
        <ReadingForm
          initialValues={{ date }}
          dayReadings={dateProblem ? null : { date, readings }}
          onSave={(values) => createReading(token, values)}
          onSaved={handleSaved}
        />
      </section>
    </section>
  );
}
