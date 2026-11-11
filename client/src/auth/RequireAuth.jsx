import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import AuthLoading from './AuthLoading.jsx';

// Layout route for pages that need a logged-in user. Anyone else is sent to
// /login, which brings them back here afterwards.
export default function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <AuthLoading />;
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}
