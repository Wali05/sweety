import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <section>
      <div className="page-header">
        <h1>Hello, {user.name}</h1>
        <p className="lead">
          Record, edit and review your blood glucose readings day by day, and
          see how you are doing with daily, month-to-date and previous-month
          reports.
        </p>
      </div>
      <div className="next-steps">
        <div className="card next-step">
          <h2>Your readings</h2>
          <p>Add today&apos;s readings, or pick another day to review or correct it.</p>
          <Link to="/readings" className="button">
            View readings
          </Link>
        </div>
        <div className="card next-step">
          <h2>Your reports</h2>
          <p>See the highest, lowest and average for a day and its month, with a chart.</p>
          <Link to="/reports" className="button button-secondary">
            View reports
          </Link>
        </div>
      </div>
      <p className="account">
        Logged in as <strong>{user.email}</strong>
      </p>
    </section>
  );
}
