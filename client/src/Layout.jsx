import { startTransition } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';

export default function Layout() {
  const { status, user, logout } = useAuth();
  const navigate = useNavigate();

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
      <header className="site-header">
        <div className="container site-header-inner">
          <Link to="/" className="brand">
            Sweety
          </Link>
          <nav aria-label="Main">
            {status === 'anonymous' && (
              <>
                <NavLink to="/login">Log in</NavLink>
                <NavLink to="/signup">Sign up</NavLink>
              </>
            )}
            {status === 'authenticated' && (
              <>
                <NavLink to="/dashboard">Dashboard</NavLink>
                <NavLink to="/readings">Readings</NavLink>
                <span className="nav-user" title={user.name}>
                  {user.name}
                </span>
                <button type="button" className="link-button" onClick={handleLogout}>
                  Log out
                </button>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}
