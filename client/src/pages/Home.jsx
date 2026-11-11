import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Home() {
  const { status } = useAuth();

  // No actions while a stored session is being checked, so a returning user
  // doesn't see Log in / Sign up flash by.
  return (
    <section className="home">
      <h1>Welcome to Sweety</h1>
      <p>
        Sweety is a blood glucose tracker. Record up to four readings a day and
        see how you are doing with daily, month-to-date and previous-month
        reports.
      </p>
      {status === 'authenticated' && (
        <div className="actions">
          <Link to="/dashboard" className="button">
            Go to dashboard
          </Link>
        </div>
      )}
      {status === 'anonymous' && (
        <div className="actions">
          <Link to="/login" className="button">
            Log in
          </Link>
          <Link to="/signup" className="button button-secondary">
            Sign up
          </Link>
        </div>
      )}
    </section>
  );
}
