import { useEffect, useState } from 'react';
import {
  fetchDailyReport,
  fetchMonthToDateReport,
  fetchPreviousMonthReport,
  isUnauthorized,
} from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';

// Loads the three reports for date ('YYYY-MM-DD'), or nothing when date is
// null. Returns { reports, error }: reports is { daily, monthToDate,
// previousMonth }, or null until all three have loaded for this date (or when
// loading failed, with the message in error).
export function useReports(date) {
  const { token, logout } = useAuth();
  // The last result and the date it is for: { date, reports, error }.
  const [loaded, setLoaded] = useState(null);

  useEffect(() => {
    if (!date) return undefined;

    // Set when the date changes or the page goes away, so a late response
    // for an old date is ignored.
    let cancelled = false;
    Promise.allSettled([
      fetchDailyReport(token, { date }),
      fetchMonthToDateReport(token, { date }),
      fetchPreviousMonthReport(token, { date }),
    ]).then((results) => {
      if (cancelled) return;

      const failures = results
        .filter((result) => result.status === 'rejected')
        .map((result) => result.reason);
      if (failures.some(isUnauthorized)) {
        // RequireAuth then sends the user to /login and back here afterwards.
        logout();
        return;
      }
      if (failures.length > 0) {
        setLoaded({ date, reports: null, error: failures[0].message });
        return;
      }

      const [daily, monthToDate, previousMonth] = results.map((result) => result.value);
      setLoaded({ date, reports: { daily, monthToDate, previousMonth }, error: '' });
    });

    return () => {
      cancelled = true;
    };
  }, [token, date, logout]);

  const current = date && loaded?.date === date ? loaded : null;
  return { reports: current?.reports ?? null, error: current?.error ?? '' };
}
