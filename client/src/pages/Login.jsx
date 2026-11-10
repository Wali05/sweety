import { Link } from 'react-router-dom';

export default function Login() {
  // Placeholder: the form is not connected to the API yet.
  function handleSubmit(event) {
    event.preventDefault();
  }

  return (
    <section className="card">
      <h1>Log in</h1>
      <p className="notice">Logging in is not available yet.</p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input id="login-email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <button type="submit" className="button">
          Log in
        </button>
      </form>
      <p className="alt">
        New to Sweety? <Link to="/signup">Sign up</Link>
      </p>
    </section>
  );
}
