// Protects routes that require login
// adminOnly prop restricts to admin session (useAdminAuthStore)
// customer routes use useAuthStore
import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import useAdminAuthStore from '../../stores/adminAuthStore';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const location = useLocation();

  // Admin routes check the dedicated admin store
  if (adminOnly) {
    const { user, token } = useAdminAuthStore();
    if (!token || !user) {
      return <Navigate to="/admin/login" state={{ from: location }} replace />;
    }
    // Sanity check — only ADMIN role allowed here
    if (user.role !== 'ADMIN') {
      return <Navigate to="/" replace />;
    }
    return children;
  }

  // Customer routes check the customer store
  const { user, token } = useAuthStore();
  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
