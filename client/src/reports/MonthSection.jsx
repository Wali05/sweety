import { Component, Suspense, lazy, useId, useMemo } from 'react';
import {
  buildChartData,
  chartSummary,
  countReadings,
  emptyChartMessage,
  monthToDateRange,
} from './chartData.js';

// Loaded only when there is something to draw, so the charting library stays
// out of the main bundle.
const MonthChart = lazy(() => import('./MonthChart.jsx'));

function Loading() {
  return (
    <p className="loading" role="status">
      Loading chart…
    </p>
  );
}

// Shows a message in place of the chart when its code cannot be loaded or it
// fails to draw, so the rest of the page stays up.
class ChartBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <p className="alert alert-error" role="alert">
        The chart could not be shown. Please reload the page.
      </p>
    );
  }
}

// The chart section: the readings from the 1st of date's month up to date,
// the same range as the month-to-date report. readings and error come from
// useMonthReadings(date).
export default function MonthSection({ date, readings, error }) {
  const id = useId();
  const { from, to } = monthToDateRange(date);
  const points = useMemo(
    () => (readings ? buildChartData(readings, from, to) : []),
    [readings, from, to]
  );
  const count = countReadings(points);

  let content;
  if (error) {
    content = (
      <p className="alert alert-error" role="alert">
        {error}
      </p>
    );
  } else if (!readings) {
    content = <Loading />;
  } else if (count === 0) {
    content = <p className="empty">{emptyChartMessage(from, to)}</p>;
  } else {
    content = (
      <>
        {/* Also the chart's text alternative. */}
        <p className="report-range" id={`${id}-summary`}>
          {chartSummary(count, from, to)}
        </p>
        <ChartBoundary>
          <Suspense fallback={<Loading />}>
            <MonthChart points={points} describedBy={`${id}-summary`} />
          </Suspense>
        </ChartBoundary>
      </>
    );
  }

  return (
    <section className="report report-chart" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>Month-to-date chart</h2>
      {content}
    </section>
  );
}
