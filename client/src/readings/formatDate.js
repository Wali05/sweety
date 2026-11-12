import { formatDate } from '../reports/formatRange.js';

const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' });

// '2026-11-12' -> 'Thu, 12 Nov 2026', to spell out what a native date input
// shows in the browser's own format. Built from the parts of the string in
// UTC, so the day never shifts with the time zone. '' for anything that is
// not a real date.
export function formatReadableDate(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? '');
  if (!match) return '';

  const [year, month, day] = match.slice(1).map(Number);
  const utc = new Date(Date.UTC(2000, month - 1, day));
  // Date.UTC reads years 0 to 99 as 1900 to 1999.
  utc.setUTCFullYear(year, month - 1, day);
  if (utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return '';

  return `${WEEKDAY.format(utc)}, ${formatDate(date)}`;
}
