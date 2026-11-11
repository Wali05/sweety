import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TOKEN_KEY, mockApi, renderApp, requestBody } from '../test/renderApp.jsx';

async function fillSignupForm(user, { name, email, password }) {
  await user.type(screen.getByLabelText('Name'), name);
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign up' }));
}

describe('Signup page', () => {
  it('rejects a short password without calling the server', async () => {
    const fetchMock = mockApi();
    const { user } = renderApp('/signup');

    await fillSignupForm(user, { name: 'Asha', email: 'asha@example.test', password: 'short' });

    expect(screen.getByRole('alert')).toHaveTextContent('Password must be at least 8 characters.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the server's message when the email is already registered", async () => {
    const fetchMock = mockApi({
      'POST /auth/signup': {
        status: 409,
        body: { error: 'An account with this email already exists.' },
      },
    });
    const { user } = renderApp('/signup');

    await fillSignupForm(user, {
      name: 'Asha',
      email: 'asha@example.test',
      password: 'long-enough',
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An account with this email already exists.'
    );
    expect(requestBody(fetchMock)).toEqual({
      name: 'Asha',
      email: 'asha@example.test',
      password: 'long-enough',
    });
    expect(screen.getByRole('heading', { name: 'Sign up' })).toBeInTheDocument();
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
