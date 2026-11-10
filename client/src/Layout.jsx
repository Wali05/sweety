import { Link, NavLink, Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <>
      <header className="site-header">
        <div className="container site-header-inner">
          <Link to="/" className="brand">
            Sweety
          </Link>
          <nav aria-label="Main">
            <NavLink to="/login">Log in</NavLink>
            <NavLink to="/signup">Sign up</NavLink>
          </nav>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}
