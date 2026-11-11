import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ASHA, TOKEN_KEY, mockApi, renderApp } from '../test/renderApp.jsx';

const ME = { 'GET /auth/me': { status: 200, body: { user: ASHA } } };

function reading(id, date, slot, slotLabel, value) {
  return { id, date, slot, slotLabel, value, createdAt: '', updatedAt: '' };
}

describe('Readings page', () => {
  beforeEach(() => {
    // Only Date is faked, so "today" is fixed but timers still run.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 15, 9, 30));
    window.localStorage.setItem(TOKEN_KEY, 'stored-token');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows today's readings in slot order with the count", async () => {
    const fetchMock = mockApi({
      ...ME,
      'GET /readings?date=2026-10-15': {
        status: 200,
        body: {
          readings: [
            reading('r3', '2026-10-15', 'after_dinner', 'After dinner', 180),
            reading('r1', '2026-10-15', 'morning_fasting', 'Morning (fasting)', 95),
            reading('r2', '2026-10-15', 'after_lunch', 'After lunch', 151),
          ],
        },
      },
    });
    renderApp('/readings');

    expect(await screen.findByText('3 of 4 readings')).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-15');
    expect(screen.getByLabelText('Date')).toHaveAttribute('max', '2026-10-15');

    const items = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(items).toEqual([
      'Morning (fasting)95 mg/dl',
      'After lunch151 mg/dl',
      'After dinner180 mg/dl',
    ]);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer stored-token');
  });

  it('shows the empty state and loads another date when it is picked', async () => {
    mockApi({
      ...ME,
      'GET /readings?date=2026-10-15': { status: 200, body: { readings: [] } },
      'GET /readings?date=2026-10-01': {
        status: 200,
        body: { readings: [reading('r1', '2026-10-01', 'after_breakfast', 'After breakfast', 140)] },
      },
    });
    renderApp('/readings');

    expect(await screen.findByText('No readings for this date yet.')).toBeInTheDocument();
    expect(screen.getByText('0 of 4 readings')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-01' } });

    expect(screen.getByRole('status')).toHaveTextContent('Loading readings…');
    expect(await screen.findByText('1 of 4 readings')).toBeInTheDocument();
    const item = within(screen.getByRole('list')).getByRole('listitem');
    expect(item).toHaveTextContent('After breakfast140 mg/dl');
    expect(screen.queryByText('No readings for this date yet.')).not.toBeInTheDocument();
  });

  it('shows an error when the readings cannot be loaded', async () => {
    mockApi({
      ...ME,
      'GET /readings?date=2026-10-15': { status: 500, body: { error: 'Something went wrong' } },
    });
    renderApp('/readings');

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.queryByText(/of 4 readings/)).not.toBeInTheDocument();
    expect(screen.queryByText('No readings for this date yet.')).not.toBeInTheDocument();
  });

  it('logs out and shows the login page when the token is rejected', async () => {
    mockApi({
      ...ME,
      'GET /readings?date=2026-10-15': {
        status: 401,
        body: { error: 'Invalid or expired token.' },
      },
    });
    renderApp('/readings');

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Readings' })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('is linked from the dashboard and the header', async () => {
    mockApi({
      ...ME,
      'GET /readings?date=2026-10-15': { status: 200, body: { readings: [] } },
    });
    const { user } = renderApp('/dashboard');

    await screen.findByRole('heading', { name: 'Hello, Asha' });
    expect(screen.getByRole('navigation', { name: 'Main' })).toContainElement(
      screen.getByRole('link', { name: 'Readings' })
    );

    await user.click(screen.getByRole('link', { name: 'View readings' }));

    expect(await screen.findByRole('heading', { name: 'Readings' })).toBeInTheDocument();
    expect(await screen.findByText('No readings for this date yet.')).toBeInTheDocument();
  });
});
