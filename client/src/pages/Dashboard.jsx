import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <section className="dashboard">
      <h1>Hello, {user.name}</h1>
      <p>
        Record, edit and review your blood glucose readings day by day, and see
        how you are doing with daily, month-to-date and previous-month reports.
      </p>
      <div className="actions">
        <Link to="/readings" className="button">
          View readings
        </Link>
        <Link to="/reports" className="button button-secondary">
          View reports
        </Link>
      </div>
      <p className="account">
        Logged in as <strong>{user.email}</strong>
      </p>
    </section>
  );
}
