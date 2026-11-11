import { useState } from 'react';
import { createReading, deleteReading, isUnauthorized, updateReading } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import ReadingForm from '../readings/ReadingForm.jsx';
import ReadingItem from '../readings/ReadingItem.jsx';
import { MAX_READINGS_PER_DAY, MESSAGES, sortBySlot, todayLocal } from '../readings/slots.js';
import { useDayReadings } from '../readings/useDayReadings.js';
import Alert from '../ui/Alert.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import Loading from '../ui/Loading.jsx';

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

  // The day's count sits beside the date once the readings have loaded.
  let count = null;
  let content;
  if (dateProblem) {
    content = <EmptyState id="readings-date-problem">{dateProblem}</EmptyState>;
  } else if (error) {
    content = <Alert title="Your readings could not be loaded.">{error}</Alert>;
  } else if (!readings) {
    content = <Loading>Loading readings…</Loading>;
  } else {
    const sorted = sortBySlot(readings);
    count = (
      <p className="reading-count">{`${sorted.length} of ${MAX_READINGS_PER_DAY} readings`}</p>
    );
    content =
      sorted.length === 0 ? (
        <EmptyState hint="Add one with the form on this page.">
          No readings for this date yet.
        </EmptyState>
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
      );
  }

  // Ties the date field to the message that says what is wrong with it.
  const dateProblemProps = dateProblem
    ? { 'aria-invalid': true, 'aria-describedby': 'readings-date-problem' }
    : {};

  return (
    <section>
      <div className="page-header">
        <h1>Readings</h1>
        <p className="lead">Pick a day to see what you recorded, then add, edit or delete.</p>
      </div>
      <div className="readings-layout">
        <div className="card">
          <div className="toolbar">
            <div className="field field-inline">
              <label htmlFor="readings-date">Date</label>
              <input
                id="readings-date"
                name="date"
                type="date"
                max={today}
                value={date}
                onChange={(event) => changeDate(event.target.value)}
                {...dateProblemProps}
              />
            </div>
            {count}
          </div>
          {notice && <Alert kind={notice.kind}>{notice.text}</Alert>}
          {content}
        </div>
        <section className="card add-reading" aria-labelledby="add-reading-heading">
          <h2 id="add-reading-heading">Add a reading</h2>
          <ReadingForm
            initialValues={{ date }}
            dayReadings={dateProblem ? null : { date, readings }}
            onSave={(values) => createReading(token, values)}
            onSaved={handleSaved}
          />
        </section>
      </div>
    </section>
  );
}
