import { cloneElement } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SLOTS } from '../readings/slots.js';
import MonthChart from '../reports/MonthChart.jsx';
import { buildChartData } from '../reports/chartData.js';

// jsdom has no layout, so ResponsiveContainer would never give the chart a
// size. Everything else is the real Recharts.
vi.mock('recharts', async (importOriginal) => ({
  ...(await importOriginal()),
  ResponsiveContainer: ({ children }) => cloneElement(children, { width: 640, height: 300 }),
}));

const reading = (date, slot, value) => ({ id: `${date}-${slot}`, date, slot, value });

const READINGS = [
  reading('2026-10-01', 'morning_fasting', 95),
  reading('2026-10-01', 'after_dinner', 172),
  reading('2026-10-04', 'morning_fasting', 101),
  reading('2026-10-04', 'after_lunch', 151),
  reading('2026-10-10', 'morning_fasting', 88),
];

function renderChart(readings = READINGS) {
  const points = buildChartData(readings, '2026-10-01', '2026-10-10');
  return render(
    <>
      <p id="summary">5 readings from 1 Oct – 10 Oct 2026</p>
      <MonthChart points={points} describedBy="summary" />
    </>
  );
}

const getChart = () => screen.getByRole('application', { name: /^Line chart of glucose readings/ });

// The tick labels of an axis ('x' or 'y') as they are drawn.
function axisLabels(container, axis) {
  return [...container.querySelectorAll(`.recharts-${axis}Axis-tick-labels text`)];
}

// How far across the chart a day of the month is, from its tick label.
function dayX(container, day) {
  const label = axisLabels(container, 'x').find((text) => text.textContent === String(day));
  return Number(label.getAttribute('x'));
}

// Moves the pointer over a day of the month and gives back its tooltip.
// Without layout the chart sits at the page's top left corner, so the day's
// x is also where the pointer has to be.
function hoverDay(container, day) {
  fireEvent.mouseMove(container.querySelector('.recharts-wrapper'), {
    clientX: dayX(container, day),
    clientY: 150,
  });
  return findTooltip(container, day);
}

// Recharts handles the pointer on the next animation frame, so the tooltip
// changes a moment later.
function findTooltip(container, day) {
  return waitFor(() => {
    const tooltip = container.querySelector('.chart-tooltip');
    expect(tooltip?.querySelector('.chart-tooltip-date')?.textContent).toBe(`${day} Oct 2026`);
    return tooltip;
  });
}

const tooltipRows = (tooltip) =>
  within(tooltip)
    .queryAllByRole('listitem')
    .map((item) => item.textContent);

describe('MonthChart', () => {
  it('has an accessible name and is described by the summary text', () => {
    renderChart();

    expect(getChart()).toHaveAccessibleDescription('5 readings from 1 Oct – 10 Oct 2026');
  });

  it('draws a line per slot, named in the legend in slot order', () => {
    const { container } = renderChart();

    // Recharts would put them in alphabetical order.
    const legend = [...container.querySelectorAll('.recharts-legend-item-text')];
    expect(legend.map((item) => item.textContent)).toEqual(SLOTS.map((slot) => slot.label));

    const lines = [...container.querySelectorAll('.recharts-line-curve')];
    expect(lines.map((line) => line.getAttribute('stroke'))).toEqual([
      'var(--slot-1)',
      'var(--slot-2)',
      'var(--slot-3)',
      'var(--slot-4)',
    ]);
    // Each legend mark has the colour of its line.
    const marks = [...container.querySelectorAll('.recharts-legend-item .recharts-legend-icon')];
    expect(marks.map((mark) => mark.getAttribute('stroke'))).toEqual(
      lines.map((line) => line.getAttribute('stroke'))
    );
  });

  it('puts a dot on every reading and none on the days without one', () => {
    const { container } = renderChart();

    const dots = (slot) =>
      container.querySelectorAll(`.recharts-line-dots circle[stroke][fill="var(--slot-${slot})"]`);
    expect(dots(1)).toHaveLength(3);
    expect(dots(2)).toHaveLength(0);
    expect(dots(3)).toHaveLength(1);
    expect(dots(4)).toHaveLength(1);
  });

  it('joins the readings of a slot across the days without one', () => {
    const { container } = renderChart();

    // A path with a single move-to is one unbroken line; a slot without
    // readings has no path to draw.
    const paths = [...container.querySelectorAll('.recharts-line-curve')].map(
      (line) => line.getAttribute('d') ?? ''
    );
    const segments = paths.map((d) => (d.match(/M/g) ?? []).length);
    expect(segments).toEqual([1, 0, 1, 1]);
    // Morning (fasting) runs from the 1st to the 10th, over the days between.
    expect(paths[0].startsWith(`M${dayX(container, 1)},`)).toBe(true);
    expect(paths[0]).toContain(`L${dayX(container, 10)},`);
  });

  it('labels the axes and explains the shaded band', () => {
    const { container } = renderChart();

    const text = [...container.querySelectorAll('svg text')].map((node) => node.textContent);
    expect(text).toContain('Day of month');
    expect(text).toContain('mg/dl');
    // Every day of the range is on the day axis, from the first to the last.
    const days = axisLabels(container, 'x').map((label) => label.textContent);
    expect(days).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    // Round values that take in the readings and the 70–180 band.
    const values = axisLabels(container, 'y').map((label) => label.textContent);
    expect(values).toEqual(['60', '80', '100', '120', '140', '160', '180']);
    expect(container.querySelector('.recharts-reference-area')).toBeInTheDocument();
    expect(screen.getByText('The shaded band marks 70–180 mg/dl.')).toBeInTheDocument();
  });

  it("shows the hovered day's full date and slot values in the tooltip", async () => {
    const { container } = renderChart();
    expect(container.querySelector('.chart-tooltip')).not.toBeInTheDocument();

    const first = await hoverDay(container, 1);
    expect(within(first).getByText('1 Oct 2026')).toBeInTheDocument();
    expect(tooltipRows(first)).toEqual(['Morning (fasting)95 mg/dl', 'After dinner172 mg/dl']);

    const fourth = await hoverDay(container, 4);
    expect(tooltipRows(fourth)).toEqual(['Morning (fasting)101 mg/dl', 'After lunch151 mg/dl']);
  });

  it('says so in the tooltip of a day without readings', async () => {
    const { container } = renderChart();

    const tooltip = await hoverDay(container, 2);
    expect(within(tooltip).getByText('2 Oct 2026')).toBeInTheDocument();
    expect(within(tooltip).getByText('No readings')).toBeInTheDocument();
    expect(tooltipRows(tooltip)).toEqual([]);
  });

  it('steps through the days with the arrow keys, reading each one out', async () => {
    const { container } = renderChart();
    const chart = getChart();

    fireEvent.focus(chart);
    const first = await findTooltip(container, 1);
    // A live region, so a screen reader announces the day.
    expect(first).toHaveAttribute('role', 'status');
    expect(first).toHaveAttribute('aria-live', 'assertive');
    expect(tooltipRows(first)).toEqual(['Morning (fasting)95 mg/dl', 'After dinner172 mg/dl']);

    fireEvent.keyDown(chart, { key: 'ArrowRight' });
    const second = await findTooltip(container, 2);
    expect(within(second).getByText('No readings')).toBeInTheDocument();

    fireEvent.keyDown(chart, { key: 'ArrowRight' });
    fireEvent.keyDown(chart, { key: 'ArrowRight' });
    expect(tooltipRows(await findTooltip(container, 4))).toEqual([
      'Morning (fasting)101 mg/dl',
      'After lunch151 mg/dl',
    ]);

    fireEvent.keyDown(chart, { key: 'ArrowLeft' });
    expect(within(await findTooltip(container, 3)).getByText('No readings')).toBeInTheDocument();
  });
});
