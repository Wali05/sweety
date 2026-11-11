import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import AuthLoading from './AuthLoading.jsx';
import { afterAuthPath } from './redirects.js';

// Layout route for /login and /signup. Someone who is already logged in is
// sent on to where those forms would take them.
export default function GuestOnly() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <AuthLoading />;
  if (status === 'authenticated') {
    return <Navigate to={afterAuthPath(location)} replace />;
  }
  return <Outlet />;
}
