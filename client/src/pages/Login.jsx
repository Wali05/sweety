import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { afterAuthPath } from '../auth/redirects.js';

// Same messages as the server; it still validates everything itself.
function validateLogin({ email, password }) {
  if (!email) return 'Email is required.';
  if (password === '') return 'Password is required.';
  return null;
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const passwordRef = useRef(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = afterAuthPath(location);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const trimmedEmail = email.trim();
    const problem = validateLogin({ email: trimmedEmail, password });
    if (problem) {
      setError(problem);
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await login(trimmedEmail, password);
    } catch (err) {
      setError(err.message);
      setPassword('');
      setSubmitting(false);
      passwordRef.current?.focus();
      return;
    }
    navigate(redirectTo, { replace: true });
  }

  return (
    <section className="card">
      <h1>Log in</h1>
      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="login-password">Password</label>
          <input
            ref={passwordRef}
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="alt">
        New to Sweety? <Link to="/signup" state={location.state}>Sign up</Link>
      </p>
    </section>
  );
}
