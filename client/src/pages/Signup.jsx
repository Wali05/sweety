import { Link } from 'react-router-dom';

export default function Signup() {
  // Placeholder: the form is not connected to the API yet.
  function handleSubmit(event) {
    event.preventDefault();
  }

  return (
    <section className="card">
      <h1>Sign up</h1>
      <p className="notice">Signing up is not available yet.</p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="signup-name">Name</label>
          <input id="signup-name" name="name" type="text" autoComplete="name" required />
        </div>
        <div className="field">
          <label htmlFor="signup-email">Email</label>
          <input id="signup-email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            aria-describedby="signup-password-hint"
            required
          />
          <p id="signup-password-hint" className="hint">
            8 to 72 characters.
          </p>
        </div>
        <button type="submit" className="button">
          Sign up
        </button>
      </form>
      <p className="alt">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </section>
  );
}
