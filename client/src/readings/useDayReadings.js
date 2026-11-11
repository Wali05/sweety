import { useCallback, useEffect, useState } from 'react';
import { isUnauthorized, listReadings } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';

// Loads the readings on date ('YYYY-MM-DD'), or nothing when date is null.
// Returns { readings, error, reload }: readings is null until this date's
// readings have loaded (or when loading failed, with the message in error).
// While reload() fetches again, the previous readings for the date stay.
export function useDayReadings(date) {
  const { token, logout } = useAuth();
  // The last response and the date it is for: { date, readings, error }.
  const [loaded, setLoaded] = useState(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (!date) return undefined;

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
        setLoaded({ date, readings: null, error: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, [token, date, reloadCount, logout]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  const current = date && loaded?.date === date ? loaded : null;
  return { readings: current?.readings ?? null, error: current?.error ?? '', reload };
}
