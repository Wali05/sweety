import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from '../App.jsx';
import { AuthProvider } from '../auth/AuthContext.jsx';

export const TOKEN_KEY = 'sweety.token';

export const ASHA = { id: 'user-1', name: 'Asha', email: 'asha@example.test' };

// Renders the whole app at `path`, the same way main.jsx does but with an
// in-memory router.
export function renderApp(path = '/') {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
  return { user };
}

export function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Replaces fetch with a mock that answers from a table such as
// { 'POST /auth/login': { status: 200, body: { user, token } } }.
// Any other request gets a 500 whose message names it, so a missing route
// shows up in the page instead of as a confusing network error.
export function mockApi(routes = {}) {
  const fetchMock = vi.fn(async (path, { method = 'GET' } = {}) => {
    const key = `${method} ${path}`;
    const route = routes[key];
    if (!route) return jsonResponse(500, { error: `Unexpected request: ${key}` });
    return jsonResponse(route.status, route.body);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

// The parsed JSON body of the nth fetch call.
export function requestBody(fetchMock, n = 0) {
  return JSON.parse(fetchMock.mock.calls[n][1].body);
}
