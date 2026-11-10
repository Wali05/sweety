import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <section className="home">
      <h1>Welcome to Sweety</h1>
      <p>
        Sweety is a blood glucose tracker. Record up to four readings a day and
        see how you are doing with daily, month-to-date and previous-month
        reports.
      </p>
      <div className="actions">
        <Link to="/login" className="button">
          Log in
        </Link>
        <Link to="/signup" className="button button-secondary">
          Sign up
        </Link>
      </div>
    </section>
  );
}
