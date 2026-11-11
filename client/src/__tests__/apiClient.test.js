import { describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  apiRequest,
  createReading,
  deleteReading,
  fetchDailyReport,
  fetchMonthToDateReport,
  fetchPreviousMonthReport,
  listReadings,
  signup,
  updateReading,
} from '../api/client.js';
import { jsonResponse } from '../test/renderApp.jsx';

describe('api client', () => {
  it('sends a JSON body with the Bearer token and resolves with the parsed response', async () => {
    const reading = { id: 'r1', date: '2026-10-15', slot: 'after_lunch', value: 151 };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { reading }));
    vi.stubGlobal('fetch', fetchMock);

    const data = await apiRequest('/readings', {
      method: 'POST',
      body: { date: '2026-10-15', slot: 'after_lunch', value: 151 },
      token: 'abc.def.ghi',
    });

    expect(data).toEqual({ reading });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe('/readings');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer abc.def.ghi',
    });
    expect(JSON.parse(init.body)).toEqual({ date: '2026-10-15', slot: 'after_lunch', value: 151 });
  });

  it("throws an ApiError with the server's message and status", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(409, { error: 'An account with this email already exists.' })
      )
    );

    const error = await signup({
      name: 'Asha',
      email: 'asha@example.test',
      password: 'long-enough',
    }).catch((err) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(error.message).toBe('An account with this email already exists.');
  });

  it('turns a network failure into an ApiError with status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const error = await apiRequest('/auth/me', { token: 'abc' }).catch((err) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.message).toBe('Could not reach the server. Please check your connection.');
  });
});

describe('readings api', () => {
  const reading = { id: 'r1', date: '2026-10-15', slot: 'after_lunch', value: 151 };

  it('lists the readings for a date', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { readings: [reading] }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await listReadings('tok', { date: '2026-10-15' })).toEqual({ readings: [reading] });
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe('/readings?date=2026-10-15');
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('creates, updates and deletes readings', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(201, { reading }))
      .mockResolvedValueOnce(jsonResponse(200, { reading: { ...reading, value: 160 } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(
      await createReading('tok', { date: '2026-10-15', slot: 'after_lunch', value: 151 })
    ).toEqual({ reading });
    expect(await updateReading('tok', 'r1', { value: 160 })).toEqual({
      reading: { ...reading, value: 160 },
    });
    expect(await deleteReading('tok', 'r1')).toBeNull();

    const calls = fetchMock.mock.calls.map(([path, init]) => [
      init.method,
      path,
      init.body && JSON.parse(init.body),
    ]);
    expect(calls).toEqual([
      ['POST', '/readings', { date: '2026-10-15', slot: 'after_lunch', value: 151 }],
      ['PATCH', '/readings/r1', { value: 160 }],
      ['DELETE', '/readings/r1', undefined],
    ]);
  });
});

describe('reports api', () => {
  const summary = { date: '2026-10-15', count: 0, empty: true };

  it('fetches each report for a date', async () => {
    const fetchMock = vi.fn(async (path) => jsonResponse(200, { ...summary, path }));
    vi.stubGlobal('fetch', fetchMock);

    const date = '2026-10-15';
    expect(await fetchDailyReport('tok', { date })).toEqual({
      ...summary,
      path: '/reports/daily?date=2026-10-15',
    });
    expect(await fetchMonthToDateReport('tok', { date })).toEqual({
      ...summary,
      path: '/reports/month-to-date?date=2026-10-15',
    });
    expect(await fetchPreviousMonthReport('tok', { date })).toEqual({
      ...summary,
      path: '/reports/previous-month?date=2026-10-15',
    });

    for (const [, init] of fetchMock.mock.calls) {
      expect(init.method).toBe('GET');
      expect(init.headers.Authorization).toBe('Bearer tok');
    }
  });

  it("leaves the date out to get the server's today", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, summary));
    vi.stubGlobal('fetch', fetchMock);

    await fetchDailyReport('tok');

    expect(fetchMock.mock.calls[0][0]).toBe('/reports/daily');
  });
});
