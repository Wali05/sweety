import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ASHA, TOKEN_KEY, mockApi, renderApp, requestBody } from '../test/renderApp.jsx';

describe('Login page', () => {
  it('checks for a missing email and password without calling the server', async () => {
    const fetchMock = mockApi();
    const { user } = renderApp('/login');

    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Email is required.');

    await user.type(screen.getByLabelText('Email'), 'asha@example.test');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Password is required.');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the server's error and clears the password", async () => {
    const fetchMock = mockApi({
      'POST /auth/login': { status: 401, body: { error: 'Invalid email or password.' } },
    });
    const { user } = renderApp('/login');

    await user.type(screen.getByLabelText('Email'), 'asha@example.test');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveFocus();
    expect(screen.getByLabelText('Email')).toHaveValue('asha@example.test');
    expect(requestBody(fetchMock)).toEqual({
      email: 'asha@example.test',
      password: 'wrong-password',
    });
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('stores the token and lands on the dashboard after logging in', async () => {
    mockApi({
      'POST /auth/login': { status: 200, body: { user: ASHA, token: 'token-123' } },
    });
    const { user } = renderApp('/login');

    await user.type(screen.getByLabelText('Email'), '  asha@example.test ');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('heading', { name: 'Hello, Asha' })).toBeInTheDocument();
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe('token-123');
    expect(screen.queryByRole('heading', { name: 'Log in' })).not.toBeInTheDocument();
  });
});
