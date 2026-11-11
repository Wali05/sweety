import { useEffect, useState } from 'react';
import { ApiError, listReadings } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import {
  MAX_READINGS_PER_DAY,
  MESSAGES,
  slotLabel,
  sortBySlot,
  todayLocal,
} from '../readings/slots.js';

// 401 means the token has expired or is no longer valid.
function isUnauthorized(err) {
  return err instanceof ApiError && err.status === 401;
}

export default function Readings() {
  const { token, logout } = useAuth();
  const today = todayLocal();

  const [date, setDate] = useState(today);
  // The last response and the date it is for: { date, readings, error }.
  const [loaded, setLoaded] = useState(null);

  // The date input's value is '' while it is empty or only partly filled in.
  let dateProblem = null;
  if (!date) dateProblem = MESSAGES.dateRequired;
  else if (date > today) dateProblem = MESSAGES.dateInFuture;

  useEffect(() => {
    if (dateProblem) return undefined;

    let cancelled = false;
    listReadings(token, { date })
      .then(({ readings }) => {
        if (!cancelled) setLoaded({ date, readings, error: '' });
      })
      .catch((err) => {
        if (cancelled) return;
        if (isUnauthorized(err)) {
          // RequireAuth then sends the user to /login and back here afterwards.
          logout();
          return;
        }
        setLoaded({ date, readings: [], error: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, [token, date, dateProblem, logout]);

  let content;
  if (dateProblem) {
    content = <p className="empty">{dateProblem}</p>;
  } else if (loaded?.date !== date) {
    content = (
      <p className="loading" role="status">
        Loading readings…
      </p>
    );
  } else if (loaded.error) {
    content = (
      <p className="alert alert-error" role="alert">
        {loaded.error}
      </p>
    );
  } else {
    const readings = sortBySlot(loaded.readings);
    content = (
      <>
        <p className="reading-count">{`${readings.length} of ${MAX_READINGS_PER_DAY} readings`}</p>
        {readings.length === 0 ? (
          <p className="empty">No readings for this date yet.</p>
        ) : (
          <ul className="reading-list">
            {readings.map((reading) => (
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
    </section>
  );
}
