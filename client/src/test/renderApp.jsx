import { render, screen } from '@testing-library/react';
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
// A route can also be a function that gets the parsed request body and
// returns (or resolves with) the answer, e.g. to answer later or to change
// what a later request returns.
// Any other request gets a 500 whose message names it, so a missing route
// shows up in the page instead of as a confusing network error.
export function mockApi(routes = {}) {
  const fetchMock = vi.fn(async (path, { method = 'GET', body } = {}) => {
    const key = `${method} ${path}`;
    let route = routes[key];
    if (!route) return jsonResponse(500, { error: `Unexpected request: ${key}` });
    if (typeof route === 'function') route = await route(body && JSON.parse(body));
    return jsonResponse(route.status, route.body);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

// The parsed JSON body of the nth fetch call.
export function requestBody(fetchMock, n = 0) {
  return JSON.parse(fetchMock.mock.calls[n][1].body);
}

// Each row of the readings list as 'Slot: value', e.g.
// 'Morning (fasting): 95 mg/dl'. Read from the row's slot and value elements,
// so the text of its buttons is left out. A row with its edit form open has
// neither and gives null.
export function readingRows() {
  return screen.getAllByRole('listitem').map((item) => {
    const slot = item.querySelector('.reading-slot');
    const value = item.querySelector('.reading-value');
    return slot && value ? `${slot.textContent}: ${value.textContent}` : null;
  });
}
