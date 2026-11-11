import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

const FEATURES = [
  {
    title: 'Four readings a day',
    text: 'Morning (fasting), after breakfast, after lunch and after dinner, each in mg/dl.',
  },
  {
    title: 'Clear summaries',
    text: 'The highest, lowest and average for a day, the month so far and the month before.',
  },
  {
    title: 'Your month as a chart',
    text: 'Every time slot is its own line, so a change over the month is easy to spot.',
  },
];

export default function Home() {
  const { status } = useAuth();

  // No actions while a stored session is being checked, so a returning user
  // doesn't see Log in / Sign up flash by.
  return (
    <div>
      <section className="hero">
        <p className="eyebrow">Blood glucose tracker</p>
        <h1>Welcome to Sweety</h1>
        <p className="lead">
          Sweety is a blood glucose tracker. Record up to four readings a day
          and see how you are doing with daily, month-to-date and previous-month
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
            <Link to="/signup" className="button">
              Sign up
            </Link>
            <Link to="/login" className="button button-secondary">
              Log in
            </Link>
          </div>
        )}
      </section>
      <ul className="feature-grid">
        {FEATURES.map((feature) => (
          <li key={feature.title} className="card">
            <h2>{feature.title}</h2>
            <p>{feature.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
