import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="hero">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p className="lead">There is nothing at this address.</p>
      <div className="actions">
        <Link to="/" className="button">
          Go back home
        </Link>
      </div>
    </section>
  );
}
