// Date ranges for the reports. Everything works on plain 'YYYY-MM-DD' strings
// and UTC arithmetic, so no range ever shifts with the server's time zone.
// Each function returns inclusive bounds as { from, to }.

function parse(date) {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

// Formats a UTC timestamp (as returned by Date.UTC) as 'YYYY-MM-DD'.
function format(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

// The selected date only.
export function dailyRange(date) {
  return { from: date, to: date };
}

// The 1st of the selected date's month up to the selected date.
export function monthToDateRange(date) {
  return { from: `${date.slice(0, 7)}-01`, to: date };
}

// The whole month before the selected date's month.
export function previousMonthRange(date) {
  const { year, month } = parse(date);

  // Date.UTC takes a zero-based month, so month - 2 is the previous month
  // (rolling January back to December of the year before), and day 0 of the
  // current month is the last day of the previous one, leap years included.
  return {
    from: format(Date.UTC(year, month - 2, 1)),
    to: format(Date.UTC(year, month - 1, 0)),
  };
}
