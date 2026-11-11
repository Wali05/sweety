import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ASHA, TOKEN_KEY, mockApi, readingRows, renderApp } from '../test/renderApp.jsx';

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

const TODAY_ROUTES = {
  [route('daily', TODAY)]: ok(DAILY),
  [route('month-to-date', TODAY)]: ok(MONTH_TO_DATE),
  [route('previous-month', TODAY)]: ok(PREVIOUS_MONTH),
};

// Another date, with a day and a month-to-date range that have no readings.
const OTHER = '2026-09-10';
const OTHER_ROUTES = {
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

describe('Reports page', () => {
  beforeEach(() => {
    // Only Date is faked, so "today" is fixed but timers still run.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 15, 9, 30));
    window.localStorage.setItem(TOKEN_KEY, 'stored-token');
  });

  afterEach(() => {
    vi.useRealTimers();
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
