// Protects routes that require login
// adminOnly prop restricts to admin session (useAdminAuthStore)
// customer routes use useAuthStore
import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import useAdminAuthStore from '../../stores/adminAuthStore';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const location = useLocation();

  // ── Admin routes ──────────────────────────────────────────────────────────
  if (adminOnly) {
    const { user, token } = useAdminAuthStore();
    if (!token || !user) {
      return <Navigate to="/admin/login" state={{ from: location }} replace />;
    }
    // Hard role check — only ADMIN role allowed inside the admin panel
    if (user.role !== 'ADMIN') {
      // Clear the corrupt admin store entry, then redirect
      useAdminAuthStore.getState().logout();
      return <Navigate to="/admin/login" replace />;
    }
    return children;
  }

  // ── Customer routes ───────────────────────────────────────────────────────
  const { user, token, logout } = useAuthStore();
  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  // An ADMIN should never access customer-only routes via the customer store.
  // Clear the corrupt session and send them to admin login.
  if (user.role === 'ADMIN') {
    logout();
    return <Navigate to="/admin/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
