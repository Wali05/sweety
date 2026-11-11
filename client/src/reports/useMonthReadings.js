import { useEffect, useState } from 'react';
import { isUnauthorized, listReadings } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { monthToDateRange } from './chartData.js';

// Loads the readings from the 1st of date's month up to date ('YYYY-MM-DD'),
// or nothing when date is null. Returns { readings, error }: readings is null
// until they have loaded for this date (or when loading failed, with the
// message in error).
export function useMonthReadings(date) {
  const { token, logout } = useAuth();
  // The last response and the date it is for: { date, readings, error }.
  const [loaded, setLoaded] = useState(null);

  useEffect(() => {
    if (!date) return undefined;

    // Set when the date changes or the page goes away, so a late response
    // for an old date is ignored.
    let cancelled = false;
    listReadings(token, monthToDateRange(date))
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
        setLoaded({ date, readings: null, error: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, [token, date, logout]);

  const current = date && loaded?.date === date ? loaded : null;
  return { readings: current?.readings ?? null, error: current?.error ?? '' };
}
