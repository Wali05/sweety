// Summary numbers shown on every report.

// Returns { count, highest, lowest, average } for a list of glucose values.
// The average is rounded to 1 decimal. With no values, count is 0 and the
// rest are null.
export function summarize(values) {
  if (values.length === 0) {
    return { count: 0, highest: null, lowest: null, average: null };
  }

  const total = values.reduce((sum, value) => sum + value, 0);

  return {
    count: values.length,
    highest: Math.max(...values),
    lowest: Math.min(...values),
    average: Math.round((total / values.length) * 10) / 10,
  };
}
