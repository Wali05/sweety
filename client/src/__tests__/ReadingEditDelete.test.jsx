import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { slotLabel } from '../readings/slots.js';
import { ASHA, TOKEN_KEY, mockApi, readingRows, renderApp } from '../test/renderApp.jsx';

const ME = { 'GET /auth/me': { status: 200, body: { user: ASHA } } };
const TODAY = '2026-10-15';

function reading(id, date, slot, value) {
  return { id, date, slot, slotLabel: slotLabel(slot), value, createdAt: '', updatedAt: '' };
}

// The route listing `date`, answered from `saved` as it is at the time, so the
// list fetched after an edit or delete shows the change.
function listOn(date, saved) {
  return {
    [`GET /readings?date=${date}`]: () => ({
      status: 200,
      body: { readings: saved.filter((item) => item.date === date) },
    }),
  };
}

// A PATCH route that applies the changes to the reading with this id in `saved`.
function patchIn(saved, id) {
  return {
    [`PATCH /readings/${id}`]: (changes) => {
      const updated = Object.assign(
        saved.find((item) => item.id === id),
        changes
      );
      return { status: 200, body: { reading: { ...updated } } };
    },
  };
}

// Opens the readings page and waits for today's list.
async function openReadings(count) {
  const { user } = renderApp('/readings');
  await screen.findByText(`${count} of 4 readings`);
  return user;
}

const editButton = (label) => screen.getByRole('button', { name: `Edit ${label} reading` });
const deleteButton = (label) => screen.getByRole('button', { name: `Delete ${label} reading` });
const editForm = (label) => screen.getByRole('form', { name: `Edit ${label} reading` });
const queryEditForm = (label) => screen.queryByRole('form', { name: `Edit ${label} reading` });

function callsWith(fetchMock, method) {
  return fetchMock.mock.calls.filter(([, init]) => init.method === method);
}

describe('Editing and deleting readings', () => {
  beforeEach(() => {
    // Only Date is faked, so "today" is fixed but timers still run.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 15, 9, 30));
    window.localStorage.setItem(TOKEN_KEY, 'stored-token');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('edits a value, sending only the value, and shows the updated list', async () => {
    const saved = [
      reading('r1', TODAY, 'morning_fasting', 95),
      reading('r2', TODAY, 'after_lunch', 151),
    ];
    const fetchMock = mockApi({ ...ME, ...listOn(TODAY, saved), ...patchIn(saved, 'r1') });
    const user = await openReadings(2);

    await user.click(editButton('Morning (fasting)'));

    const form = editForm('Morning (fasting)');
    const value = within(form).getByLabelText('Value (mg/dl)');
    expect(within(form).getByLabelText('Reading date')).toHaveValue(TODAY);
    expect(within(form).getByLabelText('Time slot')).toHaveValue('morning_fasting');
    expect(value).toHaveValue('95');
    expect(value).toHaveFocus();
    // The reading's own slot is not taken; the other one in use is.
    const options = within(form)
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options).toEqual([
      'Morning (fasting)',
      'After breakfast',
      'After lunch – taken',
      'After dinner',
    ]);

    await user.clear(value);
    await user.type(value, '110');
    await user.click(within(form).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(readingRows()).toEqual(['Morning (fasting): 110 mg/dl', 'After lunch: 151 mg/dl'])
    );
    expect(screen.getByText('Reading updated.')).toHaveAttribute('role', 'status');
    expect(queryEditForm('Morning (fasting)')).not.toBeInTheDocument();
    expect(editButton('Morning (fasting)')).toHaveFocus();

    const patches = callsWith(fetchMock, 'PATCH');
    expect(patches).toHaveLength(1);
    expect(patches[0][0]).toBe('/readings/r1');
    expect(JSON.parse(patches[0][1].body)).toEqual({ value: 110 });
    expect(patches[0][1].headers.Authorization).toBe('Bearer stored-token');
  });

  it('checks an edit the same way as a new reading before sending it', async () => {
    const fetchMock = mockApi({
      ...ME,
      ...listOn(TODAY, [
        reading('r1', TODAY, 'morning_fasting', 95),
        reading('r2', TODAY, 'after_lunch', 151),
      ]),
    });
    const user = await openReadings(2);

    await user.click(editButton('Morning (fasting)'));
    const form = editForm('Morning (fasting)');
    const slot = within(form).getByLabelText('Time slot');
    const value = within(form).getByLabelText('Value (mg/dl)');
    await user.selectOptions(slot, 'After lunch – taken');
    await user.clear(value);
    await user.type(value, '700');
    await user.click(within(form).getByRole('button', { name: 'Save' }));

    expect(slot).toHaveAccessibleDescription(
      'You already have an After lunch reading for this date.'
    );
    expect(value).toHaveAccessibleDescription('Value must be between 40 and 600 mg/dl.');
    expect(callsWith(fetchMock, 'PATCH')).toHaveLength(0);
  });

  it("shows the server's message when an edit is refused and keeps the form open", async () => {
    // For example the slot was used from another tab after the list loaded.
    const fetchMock = mockApi({
      ...ME,
      ...listOn(TODAY, [reading('r1', TODAY, 'morning_fasting', 95)]),
      'PATCH /readings/r1': {
        status: 409,
        body: { error: 'You already have an After breakfast reading for this date.' },
      },
    });
    const user = await openReadings(1);

    await user.click(editButton('Morning (fasting)'));
    const form = editForm('Morning (fasting)');
    await user.selectOptions(within(form).getByLabelText('Time slot'), 'After breakfast');
    await user.click(within(form).getByRole('button', { name: 'Save' }));

    expect(await within(form).findByRole('alert')).toHaveTextContent(
      'You already have an After breakfast reading for this date.'
    );
    expect(JSON.parse(callsWith(fetchMock, 'PATCH')[0][1].body)).toEqual({
      slot: 'after_breakfast',
    });
    expect(within(form).getByLabelText('Time slot')).toHaveValue('after_breakfast');
    expect(within(form).getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(screen.queryByText('Reading updated.')).not.toBeInTheDocument();
  });

  it('leaves the row unchanged without a request when an edit is cancelled', async () => {
    const fetchMock = mockApi({
      ...ME,
      ...listOn(TODAY, [reading('r1', TODAY, 'morning_fasting', 95)]),
    });
    const user = await openReadings(1);

    await user.click(editButton('Morning (fasting)'));
    const value = within(editForm('Morning (fasting)')).getByLabelText('Value (mg/dl)');
    await user.clear(value);
    await user.type(value, '200');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(queryEditForm('Morning (fasting)')).not.toBeInTheDocument();
    expect(readingRows()).toEqual(['Morning (fasting): 95 mg/dl']);
    expect(editButton('Morning (fasting)')).toHaveFocus();
    // Only /auth/me and today's list.
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Opening it again starts from the saved reading.
    await user.click(editButton('Morning (fasting)'));
    expect(within(editForm('Morning (fasting)')).getByLabelText('Value (mg/dl)')).toHaveValue(
      '95'
    );
  });

  it('closes without a request when an edit is saved with nothing changed', async () => {
    const fetchMock = mockApi({
      ...ME,
      ...listOn(TODAY, [reading('r1', TODAY, 'morning_fasting', 95)]),
    });
    const user = await openReadings(1);

    await user.click(editButton('Morning (fasting)'));
    const form = editForm('Morning (fasting)');
    const value = within(form).getByLabelText('Value (mg/dl)');
    // Typed again with spaces around it, which is still the same value.
    await user.clear(value);
    await user.type(value, ' 95 ');
    await user.click(within(form).getByRole('button', { name: 'Save' }));

    expect(queryEditForm('Morning (fasting)')).not.toBeInTheDocument();
    expect(screen.queryByText('Reading updated.')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('edits one row at a time', async () => {
    mockApi({
      ...ME,
      ...listOn(TODAY, [
        reading('r1', TODAY, 'morning_fasting', 95),
        reading('r2', TODAY, 'after_lunch', 151),
      ]),
    });
    const user = await openReadings(2);

    await user.click(editButton('Morning (fasting)'));
    await user.click(editButton('After lunch'));

    expect(queryEditForm('Morning (fasting)')).not.toBeInTheDocument();
    expect(readingRows()).toEqual(['Morning (fasting): 95 mg/dl', null]);
    expect(within(editForm('After lunch')).getByLabelText('Value (mg/dl)')).toHaveFocus();
  });

  it('moves the page to the new date when an edit changes it', async () => {
    const saved = [
      reading('r1', TODAY, 'after_dinner', 180),
      reading('r2', '2026-10-01', 'morning_fasting', 101),
    ];
    const fetchMock = mockApi({
      ...ME,
      ...listOn(TODAY, saved),
      ...listOn('2026-10-01', saved),
      ...patchIn(saved, 'r1'),
    });
    const user = await openReadings(1);

    await user.click(editButton('After dinner'));
    const form = editForm('After dinner');
    fireEvent.change(within(form).getByLabelText('Reading date'), {
      target: { value: '2026-10-01' },
    });
    // The form loads that date to mark its used slots.
    expect(
      await within(form).findByRole('option', { name: 'Morning (fasting) – taken' })
    ).toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('2 of 4 readings')).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-01');
    expect(readingRows()).toEqual(['Morning (fasting): 101 mg/dl', 'After dinner: 180 mg/dl']);
    expect(screen.getByText('Reading updated.')).toHaveAttribute('role', 'status');
    expect(JSON.parse(callsWith(fetchMock, 'PATCH')[0][1].body)).toEqual({ date: '2026-10-01' });
  });

  it('logs out and shows the login page when saving an edit gets a 401', async () => {
    mockApi({
      ...ME,
      ...listOn(TODAY, [reading('r1', TODAY, 'morning_fasting', 95)]),
      'PATCH /readings/r1': { status: 401, body: { error: 'Invalid or expired token.' } },
    });
    const user = await openReadings(1);

    await user.click(editButton('Morning (fasting)'));
    const value = within(editForm('Morning (fasting)')).getByLabelText('Value (mg/dl)');
    await user.clear(value);
    await user.type(value, '120');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('asks before deleting, then deletes the reading and refreshes the list', async () => {
    const saved = [
      reading('r1', TODAY, 'morning_fasting', 95),
      reading('r2', TODAY, 'after_lunch', 151),
    ];
    const fetchMock = mockApi({
      ...ME,
      ...listOn(TODAY, saved),
      'DELETE /readings/r2': () => {
        saved.splice(1, 1);
        return { status: 204 };
      },
    });
    const user = await openReadings(2);

    await user.click(deleteButton('After lunch'));

    expect(readingRows()[1]).toBe('After lunch: 151 mg/dl');
    const row = screen.getAllByRole('listitem')[1];
    expect(within(row).getByRole('group', { name: 'Delete this reading?' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(callsWith(fetchMock, 'DELETE')).toHaveLength(0);

    await user.click(within(row).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('1 of 4 readings')).toBeInTheDocument();
    expect(readingRows()).toEqual(['Morning (fasting): 95 mg/dl']);
    expect(screen.getByText('Reading deleted.')).toHaveAttribute('role', 'status');
    const deletes = callsWith(fetchMock, 'DELETE');
    expect(deletes).toHaveLength(1);
    expect(deletes[0][0]).toBe('/readings/r2');
    expect(deletes[0][1].headers.Authorization).toBe('Bearer stored-token');
  });

  it('sends nothing when a delete is cancelled', async () => {
    const fetchMock = mockApi({
      ...ME,
      ...listOn(TODAY, [
        reading('r1', TODAY, 'morning_fasting', 95),
        reading('r2', TODAY, 'after_lunch', 151),
      ]),
    });
    const user = await openReadings(2);

    await user.click(deleteButton('After lunch'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Delete this reading?')).not.toBeInTheDocument();
    expect(readingRows()).toEqual(['Morning (fasting): 95 mg/dl', 'After lunch: 151 mg/dl']);
    expect(deleteButton('After lunch')).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows the server's message when a delete fails and refreshes the list", async () => {
    const saved = [
      reading('r1', TODAY, 'morning_fasting', 95),
      reading('r2', TODAY, 'after_lunch', 151),
    ];
    mockApi({
      ...ME,
      ...listOn(TODAY, saved),
      'DELETE /readings/r2': { status: 404, body: { error: 'Reading not found.' } },
    });
    const user = await openReadings(2);

    await user.click(deleteButton('After lunch'));
    // Deleted from another tab in the meantime.
    saved.splice(1, 1);
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Reading not found.');
    expect(await screen.findByText('1 of 4 readings')).toBeInTheDocument();
    expect(readingRows()).toEqual(['Morning (fasting): 95 mg/dl']);
    expect(screen.queryByText('Reading deleted.')).not.toBeInTheDocument();
  });

  it('logs out and shows the login page when deleting gets a 401', async () => {
    mockApi({
      ...ME,
      ...listOn(TODAY, [reading('r1', TODAY, 'morning_fasting', 95)]),
      'DELETE /readings/r1': { status: 401, body: { error: 'Invalid or expired token.' } },
    });
    const user = await openReadings(1);

    await user.click(deleteButton('Morning (fasting)'));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
