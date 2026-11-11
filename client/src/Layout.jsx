import { startTransition } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';

// The drop beside the app name. Decorative: the link is named by its text.
function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2.5C8.2 7.1 6 10.4 6 13.8a6 6 0 0 0 12 0c0-3.4-2.2-6.7-6-11.3Z" />
    </svg>
  );
}

export default function Layout() {
  const { status, user, logout } = useAuth();
  const navigate = useNavigate();
  const loggedIn = status === 'authenticated';

  function handleLogout() {
    // The router applies navigations as transitions. Logging out inside the
    // same transition makes both changes land in one render; otherwise
    // RequireAuth would briefly see a logged-out user on a protected page
    // and add its own redirect to /login.
    startTransition(() => {
      logout();
      navigate('/login', { replace: true });
    });
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className={`container site-header-inner${loggedIn ? ' has-account' : ''}`}>
          <Link to="/" className="brand">
            <BrandMark />
            Sweety
          </Link>
          {/* NavLink marks the current page with aria-current="page". */}
          <nav className="site-nav" aria-label="Main">
            {status === 'anonymous' && (
              <>
                <NavLink to="/login">Log in</NavLink>
                <NavLink to="/signup">Sign up</NavLink>
              </>
            )}
            {loggedIn && (
              <>
                <NavLink to="/dashboard">Dashboard</NavLink>
                <NavLink to="/readings">Readings</NavLink>
                <NavLink to="/reports">Reports</NavLink>
              </>
            )}
          </nav>
          {loggedIn && (
            <div className="site-account">
              <span className="nav-user" title={user.name}>
                {user.name}
              </span>
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={handleLogout}
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </header>
      {/* Focusable only so the skip link can move focus here. */}
      <main id="main" className="container" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container">
          <p>
            Sweety helps you keep track of your blood glucose. It is not a substitute for medical
            advice.
          </p>
        </div>
      </footer>
    </>
  );
}
