import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Spinner } from '../ui/Feedback.jsx';

function Booting() {
  return (
    <div className="grid min-h-screen place-items-center">
      <Spinner className="h-7 w-7" />
    </div>
  );
}

/**
 * Route guards are a convenience, not the security boundary. Every protected
 * API route independently re-checks the session, the role and the subscription
 * on each request, so removing these components in devtools grants nothing.
 */
export function RequireAuth() {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) return <Booting />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

export function RequireAdmin() {
  const { loading, isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) return <Booting />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/** Redirects an already signed-in visitor away from login/register. */
export function RedirectIfAuthenticated({ children }) {
  const { loading, isAuthenticated, isAdmin } = useAuth();
  if (loading) return <Booting />;
  if (isAuthenticated) return <Navigate to={isAdmin ? '/admin' : '/dashboard'} replace />;
  return children;
}

export default RequireAuth;
