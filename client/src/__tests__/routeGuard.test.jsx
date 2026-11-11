import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ASHA, TOKEN_KEY, mockApi, renderApp } from '../test/renderApp.jsx';

describe('protected dashboard', () => {
  it('shows the login page when visited while logged out', async () => {
    const fetchMock = mockApi();
    renderApp('/dashboard');

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Hello/ })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('restores a stored session through /auth/me and shows the dashboard', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'stored-token');
    const fetchMock = mockApi({ 'GET /auth/me': { status: 200, body: { user: ASHA } } });
    renderApp('/dashboard');

    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    expect(await screen.findByRole('heading', { name: 'Hello, Asha' })).toBeInTheDocument();
    expect(screen.getByText('asha@example.test')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer stored-token');
  });

  it('clears a stored token that /auth/me rejects with 401', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'expired-token');
    mockApi({ 'GET /auth/me': { status: 401, body: { error: 'Invalid or expired token.' } } });
    renderApp('/dashboard');

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('logging out returns to the login page and removes the token', async () => {
    window.localStorage.setItem(TOKEN_KEY, 'stored-token');
    mockApi({ 'GET /auth/me': { status: 200, body: { user: ASHA } } });
    const { user } = renderApp('/dashboard');

    await screen.findByRole('heading', { name: 'Hello, Asha' });
    await user.click(screen.getByRole('button', { name: 'Log out' }));

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Hello, Asha' })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
