import { useState } from 'react';
import { createReading, deleteReading, isUnauthorized, updateReading } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import ReadingForm from '../readings/ReadingForm.jsx';
import ReadingItem from '../readings/ReadingItem.jsx';
import { MAX_READINGS_PER_DAY, MESSAGES, sortBySlot, todayLocal } from '../readings/slots.js';
import { useDayReadings } from '../readings/useDayReadings.js';

export default function Readings() {
  const { token, logout } = useAuth();
  const today = todayLocal();

  const [date, setDate] = useState(today);
  // The one row being edited or asked about: { id, mode: 'edit' | 'delete' }.
  const [active, setActive] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  // The outcome of the last edit or delete: { kind: 'success' | 'error', text }.
  const [notice, setNotice] = useState(null);

  // The date input's value is '' while it is empty or only partly filled in.
  let dateProblem = null;
  if (!date) dateProblem = MESSAGES.dateRequired;
  else if (date > today) dateProblem = MESSAGES.dateInFuture;

  const { readings, error, reload } = useDayReadings(dateProblem ? null : date);

  function changeDate(nextDate) {
    setDate(nextDate);
    setActive(null);
    setNotice(null);
  }

  function open(id, mode) {
    setActive({ id, mode });
    setNotice(null);
  }

  // Closes a row's form or question, unless another row has been opened since.
  function close(id) {
    setActive((current) => (current?.id === id ? null : current));
  }

  // Show the saved reading's date, with the list fetched again.
  function handleSaved(reading) {
    setDate(reading.date);
    setNotice(null);
    reload();
  }

  function handleUpdated(reading) {
    close(reading.id);
    setDate(reading.date);
    setNotice({ kind: 'success', text: 'Reading updated.' });
    reload();
  }

  async function handleDelete(reading) {
    setDeletingId(reading.id);
    let outcome;
    try {
      await deleteReading(token, reading.id);
      outcome = { kind: 'success', text: 'Reading deleted.' };
    } catch (err) {
      if (isUnauthorized(err)) {
        logout();
        return;
      }
      // E.g. 'Reading not found.' when it was deleted from another tab; the
      // refreshed list then shows what is really there.
      outcome = { kind: 'error', text: err.message };
    }
    setDeletingId(null);
    close(reading.id);
    setNotice(outcome);
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
              <ReadingItem
                key={reading.id}
                reading={reading}
                mode={active?.id === reading.id ? active.mode : 'view'}
                dayReadings={{ date, readings }}
                deleting={deletingId === reading.id}
                onEdit={() => open(reading.id, 'edit')}
                onAskDelete={() => open(reading.id, 'delete')}
                onCancel={() => close(reading.id)}
                onSave={(changes) => updateReading(token, reading.id, changes)}
                onSaved={handleUpdated}
                onConfirmDelete={() => handleDelete(reading)}
              />
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
          onChange={(event) => changeDate(event.target.value)}
        />
      </div>
      {notice && (
        <p
          className={`alert alert-${notice.kind}`}
          role={notice.kind === 'error' ? 'alert' : 'status'}
        >
          {notice.text}
        </p>
      )}
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
