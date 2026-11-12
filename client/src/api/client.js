// Small fetch wrapper for the Sweety API. Paths are same-origin (e.g.
// /auth/login); in development the Vite proxy forwards them to the server.

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';
const NETWORK_MESSAGE = 'Could not reach the server. Please check your connection.';

// Thrown for every failed request. status is the HTTP status, or 0 when the
// server could not be reached.
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// True when a request made with the token got a 401: it has expired or is no
// longer valid, so the user should be logged out.
export function isUnauthorized(err) {
  return err instanceof ApiError && err.status === 401;
}

// Sends a JSON request and resolves with the parsed response body (null for
// an empty body, e.g. 204 No Content). Rejects with an ApiError.
export async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  let text;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    text = await response.text();
  } catch {
    throw new ApiError(NETWORK_MESSAGE, 0);
  }

  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON, e.g. an HTML error page from a proxy.
    throw new ApiError(GENERIC_MESSAGE, response.status);
  }

  if (!response.ok) {
    const serverMessage = typeof data?.error === 'string' ? data.error : '';
    throw new ApiError(serverMessage || GENERIC_MESSAGE, response.status);
  }

  return data;
}

// Resolves with { user, token }.
export function signup({ name, email, password }) {
  return apiRequest('/auth/signup', { method: 'POST', body: { name, email, password } });
}

// Resolves with { user, token }.
export function login({ email, password }) {
  return apiRequest('/auth/login', { method: 'POST', body: { email, password } });
}

// Resolves with { user }.
export function fetchMe(token) {
  return apiRequest('/auth/me', { token });
}

// Readings. Each reading is { id, date, slot, slotLabel, value, createdAt,
// updatedAt }, with date as 'YYYY-MM-DD' and value in mg/dl.

// Resolves with { readings, page, limit, total, totalPages }: one page of the
// readings on date (YYYY-MM-DD), or of the ones from `from` up to `to` (both
// optional and inclusive), or of all the user's readings when no filter is
// given. Newest date first, in slot order within a day. page starts at 1 and
// limit is 1 to 200; the server uses page 1 and limit 20 when they are left
// out. total counts every reading matching the filter, not just this page.
export function listReadings(token, { date, from, to, page, limit } = {}) {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries({ date, from, to, page, limit })) {
    if (value !== undefined) params.set(name, value);
  }
  const query = params.size > 0 ? `?${params}` : '';
  return apiRequest(`/readings${query}`, { token });
}

// Resolves with { reading }.
export function createReading(token, { date, slot, value }) {
  return apiRequest('/readings', { method: 'POST', body: { date, slot, value }, token });
}

// changes holds any of date, slot and value. Resolves with { reading }.
export function updateReading(token, id, changes) {
  return apiRequest(`/readings/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: changes,
    token,
  });
}

// Resolves with null (204 No Content).
export function deleteReading(token, id) {
  return apiRequest(`/readings/${encodeURIComponent(id)}`, { method: 'DELETE', token });
}

// Reports. Each report is { report, date, from, to, count, highest, lowest,
// average, empty, message }: date is the selected date, from and to the
// inclusive range it covers (all 'YYYY-MM-DD'), and the values are in mg/dl
// with the average rounded to 1 decimal. A range without readings has count 0,
// null values, empty true and a friendly message (otherwise null).
// The server uses its own today when date is left out.

function fetchReport(name, token, { date } = {}) {
  const query = date === undefined ? '' : `?${new URLSearchParams({ date })}`;
  return apiRequest(`/reports/${name}${query}`, { token });
}

// The selected date only. This report also has readings, the day's readings
// in slot order, each as { id, slot, slotLabel, value }.
export function fetchDailyReport(token, { date } = {}) {
  return fetchReport('daily', token, { date });
}

// The 1st of the selected date's month up to the selected date.
export function fetchMonthToDateReport(token, { date } = {}) {
  return fetchReport('month-to-date', token, { date });
}

// The whole calendar month before the selected date's month.
export function fetchPreviousMonthReport(token, { date } = {}) {
  return fetchReport('previous-month', token, { date });
}
