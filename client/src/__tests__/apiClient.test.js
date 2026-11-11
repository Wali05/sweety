import { describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest, signup } from '../api/client.js';
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
