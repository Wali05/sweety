// Friendly text for report dates. Works on the 'YYYY-MM-DD' strings as they
// are, so nothing shifts with the browser's time zone.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(date) {
  const [year, month, day] = date.split('-').map(Number);
  return { year, dayMonth: `${day} ${MONTHS[month - 1]}` };
}

// '2026-10-15' -> '15 Oct 2026'
export function formatDate(date) {
  const { year, dayMonth } = parts(date);
  return `${dayMonth} ${year}`;
}

// An inclusive range, e.g. '1 Oct – 15 Oct 2026'. A single day is written
// once, and the first year is left out when both dates are in the same year.
export function formatRange(from, to) {
  if (from === to) return formatDate(to);
  const start = parts(from);
  const end = parts(to);
  const startText = start.year === end.year ? start.dayMonth : formatDate(from);
  return `${startText} – ${formatDate(to)}`;
}
