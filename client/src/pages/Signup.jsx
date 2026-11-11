import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

const MIN_PASSWORD_LENGTH = 8;
// Same pattern as the server: something@something.something with no spaces.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Same checks and messages as the server, which still validates everything
// itself (including the 72-byte password limit).
function validateSignup({ name, email, password }) {
  if (!name) return 'Name is required.';
  if (!email) return 'Email is required.';
  if (!EMAIL_PATTERN.test(email)) return 'Email is not valid.';
  if (password === '') return 'Password is required.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // A route guard sends people here with the page they wanted in state.from.
  const redirectTo = location.state?.from?.pathname || '/dashboard';

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const problem = validateSignup({ name: trimmedName, email: trimmedEmail, password });
    if (problem) {
      setError(problem);
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await signup(trimmedName, trimmedEmail, password);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
      return;
    }
    navigate(redirectTo, { replace: true });
  }

  return (
    <section className="card">
      <h1>Sign up</h1>
      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="signup-name">Name</label>
          <input
            id="signup-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="signup-email">Email</label>
          <input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            maxLength={72}
            aria-describedby="signup-password-hint"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <p id="signup-password-hint" className="hint">
            8 to 72 characters.
          </p>
        </div>
        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
      <p className="alt">
        Already have an account? <Link to="/login" state={location.state}>Log in</Link>
      </p>
    </section>
  );
}
