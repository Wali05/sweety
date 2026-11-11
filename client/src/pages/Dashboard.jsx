import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <section className="dashboard">
      <h1>Hello, {user.name}</h1>
      <p>
        Record, edit and review your blood glucose readings day by day. Reports
        are coming next.
      </p>
      <div className="actions">
        <Link to="/readings" className="button">
          View readings
        </Link>
      </div>
      <p className="account">
        Logged in as <strong>{user.email}</strong>
      </p>
    </section>
  );
}
