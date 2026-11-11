import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ASHA, TOKEN_KEY, mockApi, readingRows, renderApp } from '../test/renderApp.jsx';

// Set to make the chart fail to draw.
const chart = vi.hoisted(() => ({ broken: false }));

// Recharts needs a real layout to draw, which jsdom does not have. This
// stand-in for the chart shows the points it is given, so the tests can still
// check what the page hands to it. MonthChart.test.jsx covers the real one.
vi.mock('../reports/MonthChart.jsx', () => ({
  default: ({ points, describedBy }) => {
    if (chart.broken) throw new Error('The chart is broken');
    return (
      <div data-testid="month-chart" aria-describedby={describedBy}>
        {JSON.stringify(points)}
      </div>
    );
  },
}));

const ME = { 'GET /auth/me': { status: 200, body: { user: ASHA } } };
const TODAY = '2026-10-15';
const EMPTY_MESSAGE = 'No readings for this period yet.';

// A report as the API sends it. Leave numbers out for a range without readings.
function report(name, date, from, to, numbers) {
  const empty = !numbers;
  return {
    report: name,
    date,
    from,
    to,
    count: 0,
    highest: null,
    lowest: null,
    average: null,
    ...numbers,
    empty,
    message: empty ? EMPTY_MESSAGE : null,
  };
}

const route = (name, date) => `GET /reports/${name}?date=${date}`;
const ok = (body) => ({ status: 200, body });

const DAILY = {
  ...report('daily', TODAY, TODAY, TODAY, { count: 3, highest: 180, lowest: 95, average: 142 }),
  // Not in slot order, to show that the page sorts them.
  readings: [
    { id: 'r3', slot: 'after_dinner', slotLabel: 'After dinner', value: 180 },
    { id: 'r1', slot: 'morning_fasting', slotLabel: 'Morning (fasting)', value: 95 },
    { id: 'r2', slot: 'after_lunch', slotLabel: 'After lunch', value: 151 },
  ],
};
const MONTH_TO_DATE = report('month-to-date', TODAY, '2026-10-01', TODAY, {
  count: 40,
  highest: 210,
  lowest: 82,
  average: 133.4,
});
const PREVIOUS_MONTH = report('previous-month', TODAY, '2026-09-01', '2026-09-30', {
  count: 112,
  highest: 240,
  lowest: 76,
  average: 128.9,
});

// The month-to-date readings for the chart, newest date first as the API
// sends them.
const reading = (date, slot, value) => ({ id: `${date}-${slot}`, date, slot, value });
const MONTH_READINGS = [
  reading(TODAY, 'morning_fasting', 95),
  reading(TODAY, 'after_lunch', 151),
  reading(TODAY, 'after_dinner', 180),
  reading('2026-10-12', 'after_breakfast', 210),
  reading('2026-10-01', 'morning_fasting', 82),
];
const CHART_TITLE = 'Month-to-date chart';
const MONTH_SUMMARY = '5 readings from 1 Oct – 15 Oct 2026';
const readingsRoute = (from, to) => `GET /readings?from=${from}&to=${to}`;
const TODAY_READINGS = readingsRoute('2026-10-01', TODAY);

const TODAY_ROUTES = {
  [route('daily', TODAY)]: ok(DAILY),
  [route('month-to-date', TODAY)]: ok(MONTH_TO_DATE),
  [route('previous-month', TODAY)]: ok(PREVIOUS_MONTH),
  [TODAY_READINGS]: ok({ readings: MONTH_READINGS }),
};

// Another date, with a day and a month-to-date range that have no readings.
const OTHER = '2026-09-10';
const OTHER_READINGS = readingsRoute('2026-09-01', OTHER);
const EMPTY_CHART = 'No readings from 1 Sep – 10 Sep 2026 yet. Add some and they will show up here.';
const OTHER_ROUTES = {
  [OTHER_READINGS]: ok({ readings: [] }),
  [route('daily', OTHER)]: ok({ ...report('daily', OTHER, OTHER, OTHER), readings: [] }),
  [route('month-to-date', OTHER)]: ok(report('month-to-date', OTHER, '2026-09-01', OTHER)),
  [route('previous-month', OTHER)]: ok(
    report('previous-month', OTHER, '2026-08-01', '2026-08-31', {
      count: 2,
      highest: 150,
      lowest: 110,
      average: 130,
    })
  ),
};

const section = (title) => screen.getByRole('region', { name: title });

// A report section's numbers as 'Label: value', e.g. 'Highest: 180 mg/dl'.
function stats(title) {
  return [...section(title).querySelectorAll('.report-stat')].map(
    (stat) => `${stat.querySelector('dt').textContent}: ${stat.querySelector('dd').textContent}`
  );
}

function reportPaths(fetchMock) {
  return fetchMock.mock.calls.map(([path]) => path).filter((path) => path.startsWith('/reports/'));
}

function readingsPaths(fetchMock) {
  return fetchMock.mock.calls.map(([path]) => path).filter((path) => path.startsWith('/readings'));
}

// The points the chart was given.
async function chartPoints() {
  return JSON.parse((await screen.findByTestId('month-chart')).textContent);
}

const NO_READINGS = {
  morning_fasting: null,
  after_breakfast: null,
  after_lunch: null,
  after_dinner: null,
};

// Answers a route only once the returned release() is called.
function holdBack(body) {
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  return { answer: () => held.then(() => ok(body)), release };
}

describe('Reports page', () => {
  beforeEach(() => {
    // Only Date is faked, so "today" is fixed but timers still run.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 15, 9, 30));
    window.localStorage.setItem(TOKEN_KEY, 'stored-token');
  });

  afterEach(() => {
    vi.useRealTimers();
    chart.broken = false;
  });

  it("shows today's three reports with their ranges and numbers", async () => {
    const fetchMock = mockApi({ ...ME, ...TODAY_ROUTES });
    renderApp('/reports');

    expect(await screen.findByRole('heading', { name: 'Daily' })).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toHaveValue(TODAY);
    expect(screen.getByLabelText('Date')).toHaveAttribute('max', TODAY);

    expect(within(section('Daily')).getByText('15 Oct 2026')).toBeInTheDocument();
    // The average always has 1 decimal, also when it is a whole number.
    expect(stats('Daily')).toEqual([
      'Highest: 180 mg/dl',
      'Lowest: 95 mg/dl',
      'Average: 142.0 mg/dl',
      'Readings: 3',
    ]);

    expect(within(section('Month-to-date')).getByText('1 Oct – 15 Oct 2026')).toBeInTheDocument();
    expect(stats('Month-to-date')).toEqual([
      'Highest: 210 mg/dl',
      'Lowest: 82 mg/dl',
      'Average: 133.4 mg/dl',
      'Readings: 40',
    ]);

    expect(within(section('Previous month')).getByText('1 Sep – 30 Sep 2026')).toBeInTheDocument();
    expect(stats('Previous month')).toEqual([
      'Highest: 240 mg/dl',
      'Lowest: 76 mg/dl',
      'Average: 128.9 mg/dl',
      'Readings: 112',
    ]);

    expect(screen.queryByText(EMPTY_MESSAGE)).not.toBeInTheDocument();
    expect(reportPaths(fetchMock)).toEqual([
      `/reports/daily?date=${TODAY}`,
      `/reports/month-to-date?date=${TODAY}`,
      `/reports/previous-month?date=${TODAY}`,
    ]);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init.headers.Authorization).toBe('Bearer stored-token');
    }
  });

  it("lists the day's readings in slot order in the daily report only", async () => {
    mockApi({ ...ME, ...TODAY_ROUTES });
    renderApp('/reports');

    await screen.findByRole('heading', { name: 'Daily' });

    expect(within(section('Daily')).getAllByRole('listitem')).toHaveLength(3);
    expect(readingRows()).toEqual([
      'Morning (fasting): 95 mg/dl',
      'After lunch: 151 mg/dl',
      'After dinner: 180 mg/dl',
    ]);
    expect(within(section('Month-to-date')).queryByRole('list')).not.toBeInTheDocument();
    expect(within(section('Previous month')).queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows the empty state for each report without readings', async () => {
    mockApi({ ...ME, ...OTHER_ROUTES });
    vi.setSystemTime(new Date(2026, 8, 10, 9, 30));
    renderApp('/reports');

    await screen.findByRole('heading', { name: 'Daily' });

    // The range is still shown, with the message instead of the numbers.
    expect(within(section('Daily')).getByText('10 Sep 2026')).toBeInTheDocument();
    expect(within(section('Daily')).getByText(EMPTY_MESSAGE)).toBeInTheDocument();
    expect(stats('Daily')).toEqual([]);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    expect(within(section('Month-to-date')).getByText('1 Sep – 10 Sep 2026')).toBeInTheDocument();
    expect(within(section('Month-to-date')).getByText(EMPTY_MESSAGE)).toBeInTheDocument();
    expect(stats('Month-to-date')).toEqual([]);

    expect(within(section('Previous month')).queryByText(EMPTY_MESSAGE)).not.toBeInTheDocument();
    expect(stats('Previous month')).toEqual([
      'Highest: 150 mg/dl',
      'Lowest: 110 mg/dl',
      'Average: 130.0 mg/dl',
      'Readings: 2',
    ]);
  });

  it('shows an error when a report cannot be loaded', async () => {
    mockApi({
      ...ME,
      ...TODAY_ROUTES,
      [route('month-to-date', TODAY)]: { status: 500, body: { error: 'Something went wrong' } },
    });
    renderApp('/reports');

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.queryByText(EMPTY_MESSAGE)).not.toBeInTheDocument();
    // The date can still be changed to try again.
    expect(screen.getByLabelText('Date')).toHaveValue(TODAY);
  });

  it('logs out and shows the login page when the token is rejected', async () => {
    mockApi({
      ...ME,
      ...TODAY_ROUTES,
      [route('previous-month', TODAY)]: {
        status: 401,
        body: { error: 'Invalid or expired token.' },
      },
    });
    renderApp('/reports');

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Reports' })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('loads the reports again when another date is picked', async () => {
    const fetchMock = mockApi({ ...ME, ...TODAY_ROUTES, ...OTHER_ROUTES });
    renderApp('/reports');

    await screen.findByText('1 Oct – 15 Oct 2026');

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: OTHER } });

    expect(screen.getByRole('status')).toHaveTextContent('Loading reports…');
    expect(screen.queryByRole('region')).not.toBeInTheDocument();

    expect(await screen.findByText('1 Aug – 31 Aug 2026')).toBeInTheDocument();
    expect(within(section('Daily')).getByText('10 Sep 2026')).toBeInTheDocument();
    expect(within(section('Month-to-date')).getByText('1 Sep – 10 Sep 2026')).toBeInTheDocument();
    expect(screen.queryByText('1 Oct – 15 Oct 2026')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(reportPaths(fetchMock).slice(3)).toEqual([
      `/reports/daily?date=${OTHER}`,
      `/reports/month-to-date?date=${OTHER}`,
      `/reports/previous-month?date=${OTHER}`,
    ]);
    expect(readingsPaths(fetchMock)).toEqual([
      `/readings?from=2026-10-01&to=${TODAY}`,
      `/readings?from=2026-09-01&to=${OTHER}`,
    ]);
  });

  it('ignores a late response for a date that is no longer selected', async () => {
    // Today's reports are answered only once release() is called.
    let release;
    const held = new Promise((resolve) => {
      release = resolve;
    });
    const late = (body) => () => held.then(() => ok(body));
    const fetchMock = mockApi({
      ...ME,
      [route('daily', TODAY)]: late(DAILY),
      [route('month-to-date', TODAY)]: late(MONTH_TO_DATE),
      [route('previous-month', TODAY)]: late(PREVIOUS_MONTH),
      [TODAY_READINGS]: late({ readings: MONTH_READINGS }),
      ...OTHER_ROUTES,
    });
    renderApp('/reports');

    await waitFor(() => expect(reportPaths(fetchMock)).toHaveLength(3));
    expect(screen.getByRole('status')).toHaveTextContent('Loading reports…');

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: OTHER } });
    expect(await screen.findByText('1 Aug – 31 Aug 2026')).toBeInTheDocument();

    await act(async () => {
      release();
      await Promise.all(fetchMock.mock.results.map((result) => result.value));
      // Gives the page time to handle the responses.
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(screen.getByLabelText('Date')).toHaveValue(OTHER);
    expect(within(section('Daily')).getByText('10 Sep 2026')).toBeInTheDocument();
    expect(screen.getByText('1 Aug – 31 Aug 2026')).toBeInTheDocument();
    expect(screen.queryByText('1 Oct – 15 Oct 2026')).not.toBeInTheDocument();
    // The chart does not go back to the old month either.
    expect(within(section(CHART_TITLE)).getByText(EMPTY_CHART)).toBeInTheDocument();
    expect(screen.queryByTestId('month-chart')).not.toBeInTheDocument();
    expect(screen.queryByText(MONTH_SUMMARY)).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('asks for a valid date instead of loading reports without one', async () => {
    const fetchMock = mockApi({ ...ME, ...TODAY_ROUTES });
    renderApp('/reports');

    await screen.findByRole('heading', { name: 'Daily' });

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '' } });
    expect(screen.getByText('Please choose a date.')).toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-16' } });
    expect(screen.getByText('Date cannot be in the future.')).toBeInTheDocument();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(reportPaths(fetchMock)).toHaveLength(3);
    expect(readingsPaths(fetchMock)).toHaveLength(1);
  });

  describe('chart of the month', () => {
    it('loads the month-to-date readings and charts them below the summaries', async () => {
      const fetchMock = mockApi({ ...ME, ...TODAY_ROUTES });
      renderApp('/reports');

      await screen.findByRole('heading', { name: CHART_TITLE });

      expect(readingsPaths(fetchMock)).toEqual([`/readings?from=2026-10-01&to=${TODAY}`]);
      const [, init] = fetchMock.mock.calls.find(([path]) => path.startsWith('/readings'));
      expect(init.headers.Authorization).toBe('Bearer stored-token');

      // Last on the page, after the three summaries.
      const titles = screen.getAllByRole('heading', { level: 2 }).map((h2) => h2.textContent);
      expect(titles).toEqual(['Daily', 'Month-to-date', 'Previous month', CHART_TITLE]);

      // The summary text is also the chart's description.
      expect(within(section(CHART_TITLE)).getByText(MONTH_SUMMARY)).toBeInTheDocument();
      const chart = await screen.findByTestId('month-chart');
      expect(section(CHART_TITLE)).toContainElement(chart);
      expect(chart).toHaveAccessibleDescription(MONTH_SUMMARY);

      // A point for every day so far this month, each value in its day and slot.
      const points = await chartPoints();
      expect(points.map((point) => point.day)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
      const withReadings = points.filter((point) =>
        Object.keys(NO_READINGS).some((slot) => point[slot] !== null)
      );
      expect(withReadings).toEqual([
        { day: 1, date: '2026-10-01', ...NO_READINGS, morning_fasting: 82 },
        { day: 12, date: '2026-10-12', ...NO_READINGS, after_breakfast: 210 },
        {
          day: 15,
          date: TODAY,
          morning_fasting: 95,
          after_breakfast: null,
          after_lunch: 151,
          after_dinner: 180,
        },
      ]);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('says so instead of showing an empty chart when the month has no readings', async () => {
      const fetchMock = mockApi({ ...ME, ...OTHER_ROUTES });
      vi.setSystemTime(new Date(2026, 8, 10, 9, 30));
      renderApp('/reports');

      expect(await screen.findByText(EMPTY_CHART)).toBeInTheDocument();
      expect(section(CHART_TITLE)).toContainElement(screen.getByText(EMPTY_CHART));
      expect(screen.queryByTestId('month-chart')).not.toBeInTheDocument();
      expect(screen.queryByText(/\d+ readings? (from|on) /)).not.toBeInTheDocument();
      expect(readingsPaths(fetchMock)).toEqual([`/readings?from=2026-09-01&to=${OTHER}`]);
    });

    it('asks for a single day on the 1st of a month', async () => {
      const first = '2026-10-01';
      const fetchMock = mockApi({
        ...ME,
        [route('daily', first)]: ok({ ...report('daily', first, first, first), readings: [] }),
        [route('month-to-date', first)]: ok(report('month-to-date', first, first, first)),
        [route('previous-month', first)]: ok(
          report('previous-month', first, '2026-09-01', '2026-09-30')
        ),
        [readingsRoute(first, first)]: ok({ readings: [reading(first, 'after_lunch', 151)] }),
      });
      vi.setSystemTime(new Date(2026, 9, 1, 9, 30));
      renderApp('/reports');

      expect(await screen.findByText('1 reading on 1 Oct 2026')).toBeInTheDocument();
      expect(await chartPoints()).toEqual([
        { day: 1, date: first, ...NO_READINGS, after_lunch: 151 },
      ]);
      expect(readingsPaths(fetchMock)).toEqual([`/readings?from=${first}&to=${first}`]);
    });

    it('shows that the chart is loading while the summaries are already there', async () => {
      const readings = holdBack({ readings: MONTH_READINGS });
      mockApi({ ...ME, ...TODAY_ROUTES, [TODAY_READINGS]: readings.answer });
      renderApp('/reports');

      await screen.findByRole('heading', { name: 'Daily' });
      expect(stats('Daily')).toHaveLength(4);
      expect(within(section(CHART_TITLE)).getByRole('status')).toHaveTextContent('Loading chart…');
      expect(screen.queryByTestId('month-chart')).not.toBeInTheDocument();

      readings.release();

      expect(await screen.findByTestId('month-chart')).toBeInTheDocument();
      expect(screen.getByText(MONTH_SUMMARY)).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('shows an error in its section when the readings cannot be loaded', async () => {
      mockApi({
        ...ME,
        ...TODAY_ROUTES,
        [TODAY_READINGS]: { status: 500, body: { error: 'Something went wrong' } },
      });
      renderApp('/reports');

      await screen.findByRole('heading', { name: CHART_TITLE });
      expect(await within(section(CHART_TITLE)).findByRole('alert')).toHaveTextContent(
        'Something went wrong'
      );
      expect(screen.queryByTestId('month-chart')).not.toBeInTheDocument();
      // The summaries do not depend on it.
      expect(stats('Daily')).toHaveLength(4);
      expect(stats('Month-to-date')).toHaveLength(4);
    });

    it('keeps the rest of the page when the chart itself fails', async () => {
      chart.broken = true;
      // React reports the error it caught; keep it out of the test output.
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockApi({ ...ME, ...TODAY_ROUTES });
      renderApp('/reports');

      await screen.findByRole('heading', { name: CHART_TITLE });
      expect(await within(section(CHART_TITLE)).findByRole('alert')).toHaveTextContent(
        'The chart could not be shown. Please reload the page.'
      );
      expect(screen.queryByTestId('month-chart')).not.toBeInTheDocument();
      expect(within(section(CHART_TITLE)).getByText(MONTH_SUMMARY)).toBeInTheDocument();
      expect(stats('Daily')).toHaveLength(4);
      expect(stats('Month-to-date')).toHaveLength(4);
    });

    it('logs out and shows the login page when the readings request is rejected', async () => {
      mockApi({
        ...ME,
        ...TODAY_ROUTES,
        [TODAY_READINGS]: { status: 401, body: { error: 'Invalid or expired token.' } },
      });
      renderApp('/reports');

      expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Reports' })).not.toBeInTheDocument();
      expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
    });

    it('charts the new month when another date is picked', async () => {
      mockApi({
        ...ME,
        ...TODAY_ROUTES,
        ...OTHER_ROUTES,
        [OTHER_READINGS]: ok({ readings: [reading('2026-09-02', 'after_dinner', 166)] }),
      });
      renderApp('/reports');

      expect(await chartPoints()).toHaveLength(15);

      fireEvent.change(screen.getByLabelText('Date'), { target: { value: OTHER } });

      expect(await screen.findByText('1 reading from 1 Sep – 10 Sep 2026')).toBeInTheDocument();
      const points = await chartPoints();
      expect(points).toHaveLength(10);
      expect(points[1]).toEqual({ day: 2, date: '2026-09-02', ...NO_READINGS, after_dinner: 166 });
      expect(screen.queryByText(MONTH_SUMMARY)).not.toBeInTheDocument();
    });

    it('ignores late readings for a date that is no longer selected', async () => {
      // Only the readings are late here; today's summaries arrive at once.
      const readings = holdBack({ readings: MONTH_READINGS });
      const fetchMock = mockApi({
        ...ME,
        ...TODAY_ROUTES,
        [TODAY_READINGS]: readings.answer,
        ...OTHER_ROUTES,
      });
      renderApp('/reports');

      await screen.findByRole('heading', { name: 'Daily' });
      fireEvent.change(screen.getByLabelText('Date'), { target: { value: OTHER } });
      expect(await screen.findByText(EMPTY_CHART)).toBeInTheDocument();

      await act(async () => {
        readings.release();
        await Promise.all(fetchMock.mock.results.map((result) => result.value));
        // Gives the page time to handle the response.
        await new Promise((resolve) => setTimeout(resolve, 20));
      });

      expect(screen.getByText(EMPTY_CHART)).toBeInTheDocument();
      expect(screen.queryByTestId('month-chart')).not.toBeInTheDocument();
      expect(screen.queryByText(MONTH_SUMMARY)).not.toBeInTheDocument();
    });
  });

  it('is linked from the dashboard and the header', async () => {
    mockApi({ ...ME, ...TODAY_ROUTES });
    const { user } = renderApp('/dashboard');

    await screen.findByRole('heading', { name: 'Hello, Asha' });
    expect(screen.queryByText(/coming next/i)).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toContainElement(
      screen.getByRole('link', { name: 'Reports' })
    );

    await user.click(screen.getByRole('link', { name: 'View reports' }));

    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Daily' })).toBeInTheDocument();
  });

  it('sends a logged-out visitor to the login page', async () => {
    window.localStorage.clear();
    const fetchMock = mockApi();
    renderApp('/reports');

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Reports' })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
