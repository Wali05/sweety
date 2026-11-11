import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { slotLabel } from '../readings/slots.js';
import {
  ASHA,
  TOKEN_KEY,
  mockApi,
  readingRows,
  renderApp,
  requestBody,
} from '../test/renderApp.jsx';

const ME = { 'GET /auth/me': { status: 200, body: { user: ASHA } } };
const TODAY = '2026-10-15';

function reading(id, date, slot, value) {
  return { id, date, slot, slotLabel: slotLabel(slot), value, createdAt: '', updatedAt: '' };
}

// The route for today's readings, which the page loads first.
function todayWith(...readings) {
  return { [`GET /readings?date=${TODAY}`]: { status: 200, body: { readings } } };
}

// Opens the readings page and waits for today's list, so the form knows which
// slots are taken.
async function openReadings(count = 0) {
  const { user } = renderApp('/readings');
  await screen.findByText(`${count} of 4 readings`);
  return user;
}

const dateInput = () => screen.getByLabelText('Reading date');
const slotSelect = () => screen.getByLabelText('Time slot');
const valueInput = () => screen.getByLabelText('Value (mg/dl)');
const addButton = () => screen.getByRole('button', { name: 'Add reading' });

function postCalls(fetchMock) {
  return fetchMock.mock.calls.filter(([, init]) => init.method === 'POST');
}

describe('Add a reading form', () => {
  beforeEach(() => {
    // Only Date is faked, so "today" is fixed but timers still run.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 15, 9, 30));
    window.localStorage.setItem(TOKEN_KEY, 'stored-token');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks for a glucose value without calling the server', async () => {
    const fetchMock = mockApi({ ...ME, ...todayWith() });
    const user = await openReadings();

    await user.click(addButton());

    expect(valueInput()).toHaveAccessibleDescription('Please enter a glucose value.');
    expect(valueInput()).toHaveAttribute('aria-invalid', 'true');
    expect(valueInput()).toHaveFocus();
    expect(postCalls(fetchMock)).toHaveLength(0);

    // The message goes away once the field is edited.
    await user.type(valueInput(), '1');
    expect(valueInput()).not.toHaveAccessibleDescription();
  });

  it('rejects values that are out of range or not whole numbers', async () => {
    const fetchMock = mockApi({ ...ME, ...todayWith() });
    const user = await openReadings();

    for (const text of ['39', '601', '120.5', '1e2', '-50', 'abc']) {
      await user.clear(valueInput());
      await user.type(valueInput(), text);
      await user.click(addButton());

      expect(valueInput()).toHaveAccessibleDescription('Value must be between 40 and 600 mg/dl.');
    }
    expect(postCalls(fetchMock)).toHaveLength(0);
  });

  it('rejects a future date without calling the server', async () => {
    const fetchMock = mockApi({ ...ME, ...todayWith() });
    const user = await openReadings();

    fireEvent.change(dateInput(), { target: { value: '2026-10-16' } });
    await user.type(valueInput(), '120');
    await user.click(addButton());

    expect(dateInput()).toHaveAccessibleDescription('Date cannot be in the future.');
    expect(dateInput()).toHaveFocus();
    // Only /auth/me and today's list: nothing is loaded or sent for the 16th.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('asks for a date when the date is cleared', async () => {
    const fetchMock = mockApi({ ...ME, ...todayWith() });
    const user = await openReadings();

    // A browser date input reports an impossible or partly typed date as ''.
    fireEvent.change(dateInput(), { target: { value: '' } });
    await user.type(valueInput(), '120');
    await user.click(addButton());

    expect(dateInput()).toHaveAccessibleDescription('Please choose a date.');
    expect(dateInput()).toHaveAttribute('aria-invalid', 'true');
    expect(dateInput()).toHaveFocus();
    expect(postCalls(fetchMock)).toHaveLength(0);
  });

  it('shows each field message at once and focuses the first field', async () => {
    mockApi({ ...ME, ...todayWith(reading('r1', TODAY, 'morning_fasting', 95)) });
    const user = await openReadings(1);

    await user.selectOptions(slotSelect(), 'Morning (fasting) – taken');
    await user.click(addButton());

    expect(slotSelect()).toHaveAccessibleDescription(
      'You already have a Morning (fasting) reading for this date.'
    );
    expect(valueInput()).toHaveAccessibleDescription('Please enter a glucose value.');
    expect(slotSelect()).toHaveFocus();
  });

  it("shows the server's validation message for a 400", async () => {
    // The browser's today can be ahead of the server's time zone.
    const fetchMock = mockApi({
      ...ME,
      ...todayWith(),
      'POST /readings': { status: 400, body: { error: 'Date cannot be in the future.' } },
    });
    const user = await openReadings();

    await user.type(valueInput(), '120');
    await user.click(addButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Date cannot be in the future.');
    expect(postCalls(fetchMock)).toHaveLength(1);
    expect(valueInput()).toHaveValue('120');
    expect(addButton()).toBeEnabled();

    // Editing a field hides the server's message.
    await user.type(valueInput(), '1');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('marks used slots as taken and stops a duplicate slot before sending', async () => {
    const fetchMock = mockApi({
      ...ME,
      ...todayWith(
        reading('r1', TODAY, 'morning_fasting', 95),
        reading('r2', TODAY, 'after_lunch', 151)
      ),
    });
    const user = await openReadings(2);

    expect(dateInput()).toHaveValue(TODAY);
    expect(dateInput()).toHaveAttribute('max', TODAY);
    const options = within(slotSelect())
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options).toEqual([
      'Morning (fasting) – taken',
      'After breakfast',
      'After lunch – taken',
      'After dinner',
    ]);
    // The first free slot is picked to start with.
    expect(slotSelect()).toHaveValue('after_breakfast');

    await user.selectOptions(slotSelect(), 'After lunch – taken');
    await user.type(valueInput(), '120');
    await user.click(addButton());

    expect(slotSelect()).toHaveAccessibleDescription(
      'You already have an After lunch reading for this date.'
    );
    expect(slotSelect()).toHaveFocus();
    expect(postCalls(fetchMock)).toHaveLength(0);
  });

  it("shows the server's message when it refuses the reading", async () => {
    // For example a reading saved from another tab after the list loaded.
    const fetchMock = mockApi({
      ...ME,
      ...todayWith(),
      'POST /readings': {
        status: 409,
        body: { error: 'You already have a Morning (fasting) reading for this date.' },
      },
    });
    const user = await openReadings();

    await user.type(valueInput(), '40');
    await user.click(addButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You already have a Morning (fasting) reading for this date.'
    );
    expect(requestBody(fetchMock, 2)).toEqual({ date: TODAY, slot: 'morning_fasting', value: 40 });
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer stored-token');
    // The value is kept so it can be saved in another slot.
    expect(valueInput()).toHaveValue('40');
    expect(addButton()).toBeEnabled();
  });

  it('saves a reading, refreshes the list and gets ready for the next one', async () => {
    const saved = [reading('r1', TODAY, 'morning_fasting', 95)];
    let finishSave;
    const fetchMock = mockApi({
      ...ME,
      // Answers with whatever has been saved so far.
      [`GET /readings?date=${TODAY}`]: () => ({ status: 200, body: { readings: saved } }),
      'POST /readings': async (body) => {
        await new Promise((resolve) => {
          finishSave = resolve;
        });
        const created = reading('r2', body.date, body.slot, body.value);
        saved.push(created);
        return { status: 201, body: { reading: created } };
      },
    });
    const user = await openReadings(1);

    await user.type(valueInput(), ' 140 ');
    await user.click(addButton());

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    finishSave();

    expect(await screen.findByText('2 of 4 readings')).toBeInTheDocument();
    expect(requestBody(fetchMock, 2)).toEqual({ date: TODAY, slot: 'after_breakfast', value: 140 });
    expect(readingRows()).toEqual(['Morning (fasting): 95 mg/dl', 'After breakfast: 140 mg/dl']);
    expect(screen.getByText('Reading saved.')).toHaveAttribute('role', 'status');
    expect(valueInput()).toHaveValue('');
    expect(slotSelect()).toHaveValue('after_lunch');
    expect(addButton()).toBeEnabled();
  });

  it('saves to another date and switches the page to it', async () => {
    const earlier = [reading('r1', '2026-10-01', 'morning_fasting', 101)];
    const fetchMock = mockApi({
      ...ME,
      ...todayWith(),
      'GET /readings?date=2026-10-01': () => ({ status: 200, body: { readings: earlier } }),
      'POST /readings': (body) => {
        const created = reading('r2', body.date, body.slot, body.value);
        earlier.push(created);
        return { status: 201, body: { reading: created } };
      },
    });
    const user = await openReadings();

    fireEvent.change(dateInput(), { target: { value: '2026-10-01' } });

    // The form loads that date to mark its used slots; the page stays on today.
    expect(
      await screen.findByRole('option', { name: 'Morning (fasting) – taken' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toHaveValue(TODAY);

    await user.type(valueInput(), '180');
    await user.click(addButton());

    expect(await screen.findByText('2 of 4 readings')).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-01');
    expect(requestBody(fetchMock, 3)).toEqual({
      date: '2026-10-01',
      slot: 'after_breakfast',
      value: 180,
    });
    expect(screen.getByText('Reading saved.')).toBeInTheDocument();
  });

  it('is disabled with the limit message when the day already has 4 readings', async () => {
    mockApi({
      ...ME,
      ...todayWith(
        reading('r1', TODAY, 'morning_fasting', 95),
        reading('r2', TODAY, 'after_breakfast', 140),
        reading('r3', TODAY, 'after_lunch', 151),
        reading('r4', TODAY, 'after_dinner', 180)
      ),
    });
    await openReadings(4);

    expect(screen.getByText('You can add only 4 readings per day.')).toHaveAttribute(
      'role',
      'status'
    );
    expect(slotSelect()).toBeDisabled();
    expect(valueInput()).toBeDisabled();
    expect(addButton()).toBeDisabled();
    // Another date can still be picked.
    expect(dateInput()).toBeEnabled();
  });

  it('logs out and shows the login page when saving gets a 401', async () => {
    mockApi({
      ...ME,
      ...todayWith(),
      'POST /readings': { status: 401, body: { error: 'Invalid or expired token.' } },
    });
    const user = await openReadings();

    await user.type(valueInput(), '120');
    await user.click(addButton());

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
