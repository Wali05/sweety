import { useAuth } from '../auth/AuthContext.jsx';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <section className="dashboard">
      <h1>Hello, {user.name}</h1>
      <p>Recording readings and viewing reports are coming next.</p>
      <p className="account">
        Logged in as <strong>{user.email}</strong>
      </p>
    </section>
  );
}
