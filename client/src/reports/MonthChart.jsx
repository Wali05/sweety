import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SLOTS } from '../readings/slots.js';
import { RANGE_HIGH, RANGE_LOW, valueAxis } from './chartData.js';
import { formatDate } from './formatRange.js';

// One line per slot, in slot order. The colours are set in index.css.
const SERIES = SLOTS.map((slot, index) => ({ ...slot, color: `var(--slot-${index + 1})` }));

// Recharts sorts the legend by label unless told otherwise.
const slotOrder = (item) => SERIES.findIndex((series) => series.key === item.dataKey);

const AXIS_TEXT = { fill: 'var(--muted)', fontSize: 12 };
const AXIS_LINE = { stroke: 'var(--border)' };

// The day under the pointer or picked with the arrow keys: its full date and
// the readings taken that day. A live region, like Recharts' own tooltip, so
// screen readers read each day out.
function DayTooltip({ active, payload }) {
  const point = active && payload?.[0]?.payload;
  if (!point) return null;

  const taken = SERIES.filter((series) => point[series.key] !== null);
  return (
    <div className="chart-tooltip" role="status" aria-live="assertive">
      <p className="chart-tooltip-date">{formatDate(point.date)}</p>
      {taken.length === 0 ? (
        <p className="chart-tooltip-empty">No readings</p>
      ) : (
        <ul>
          {taken.map((series) => (
            <li key={series.key}>
              <span className="chart-swatch" style={{ background: series.color }} aria-hidden="true" />
              <span className="chart-tooltip-slot">{series.label}</span>
              <span className="reading-value">
                {point[series.key]} <span className="reading-unit">mg/dl</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Line chart of a month's readings: the day of the month across, mg/dl up,
// and a line per slot. points comes from buildChartData(); describedBy is the
// id of the element that says in words what the chart shows.
export default function MonthChart({ points, describedBy }) {
  const { domain, ticks } = valueAxis(points);

  return (
    <div className="month-chart">
      <ResponsiveContainer width="100%" height={320}>
        <LineChart
          data={points}
          margin={{ top: 8, right: 8, bottom: 16, left: 0 }}
          aria-label="Line chart of glucose readings for each day of the month, one line per time slot"
          aria-describedby={describedBy}
        >
          <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
          <ReferenceArea
            y1={RANGE_LOW}
            y2={RANGE_HIGH}
            fill="var(--accent)"
            fillOpacity={0.07}
            stroke="none"
          />
          <XAxis
            dataKey="day"
            padding={{ left: 12, right: 12 }}
            tick={AXIS_TEXT}
            tickLine={false}
            axisLine={AXIS_LINE}
            minTickGap={12}
            label={{ value: 'Day of month', position: 'insideBottom', offset: -10, ...AXIS_TEXT }}
          />
          <YAxis
            domain={domain}
            ticks={ticks}
            width={52}
            tick={AXIS_TEXT}
            tickLine={false}
            axisLine={false}
            label={{ value: 'mg/dl', angle: -90, position: 'insideLeft', offset: 12, ...AXIS_TEXT }}
          />
          {/* filterNull is off so a day without readings still gets its tooltip. */}
          <Tooltip content={<DayTooltip />} cursor={AXIS_LINE} filterNull={false} />
          <Legend
            verticalAlign="top"
            itemSorter={slotOrder}
            formatter={(label) => <span className="chart-legend-label">{label}</span>}
            wrapperStyle={{ position: 'relative', paddingBottom: 8 }}
          />
          {SERIES.map((series) => (
            <Line
              key={series.key}
              dataKey={series.key}
              name={series.label}
              stroke={series.color}
              strokeWidth={2}
              // Joins a slot's readings across days without one.
              connectNulls
              dot={{ r: 3.5, fill: series.color, stroke: 'var(--surface)', strokeWidth: 1.5 }}
              activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <p className="hint">
        The shaded band marks {RANGE_LOW}–{RANGE_HIGH} mg/dl.
      </p>
    </div>
  );
}
