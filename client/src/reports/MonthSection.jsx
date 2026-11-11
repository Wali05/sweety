import { Component, Suspense, lazy, useId, useMemo } from 'react';
import Alert from '../ui/Alert.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import Loading from '../ui/Loading.jsx';
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

function ChartLoading() {
  return <Loading>Loading chart…</Loading>;
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
    return <Alert>The chart could not be shown. Please reload the page.</Alert>;
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
    content = <Alert title="The chart could not be loaded.">{error}</Alert>;
  } else if (!readings) {
    content = <ChartLoading />;
  } else if (count === 0) {
    content = <EmptyState>{emptyChartMessage(from, to)}</EmptyState>;
  } else {
    content = (
      <>
        {/* Also the chart's text alternative. */}
        <p className="report-range" id={`${id}-summary`}>
          {chartSummary(count, from, to)}
        </p>
        <ChartBoundary>
          <Suspense fallback={<ChartLoading />}>
            <MonthChart points={points} describedBy={`${id}-summary`} />
          </Suspense>
        </ChartBoundary>
      </>
    );
  }

  return (
    <section className="card report report-chart" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>Month-to-date chart</h2>
      {content}
    </section>
  );
}
