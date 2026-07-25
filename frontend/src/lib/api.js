import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '/api',
  timeout: 20000,
});

// Attach correct JWT token based on current page context.
// We use a strict check: only routes that are INSIDE the admin panel
// (i.e. not /admin/login itself) should use the admin token.
// This prevents the login page from accidentally sending a stale token.
api.interceptors.request.use((config) => {
  const path = window.location.pathname;

  // /admin/login is an AUTH page — never attach any existing token here.
  // All other /admin/* paths are inside the protected panel — use admin token.
  const isInsideAdminPanel =
    path.startsWith('/admin') && path !== '/admin/login';

  const tokenKey = isInsideAdminPanel ? 'zouq_admin_token' : 'zouq_customer_token';
  const token = localStorage.getItem(tokenKey);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalize error responses
api.interceptors.response.use(
  (response) => response,
  (err) => {
    const message =
      err.response?.data?.message ||
      err.response?.data?.errors?.[0]?.msg ||
      'Something went wrong. Please try again.';

    // 401 = session expired — log out the correct store and redirect
    if (err.response?.status === 401) {
      const path = window.location.pathname;
      const isInsideAdminPanel = path.startsWith('/admin') && path !== '/admin/login';
      const isAuthPage =
        path === '/login' ||
        path === '/signup' ||
        path === '/admin/login';

      if (!isAuthPage) {
        if (isInsideAdminPanel) {
          import('../stores/adminAuthStore').then(({ default: useAdminAuthStore }) => {
            useAdminAuthStore.getState().logout();
          });
          window.location.href = '/admin/login';
        } else {
          import('../stores/authStore').then(({ default: useAuthStore }) => {
            useAuthStore.getState().logout();
          });
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject({ message, status: err.response?.status, data: err.response?.data });
  }
);

export default api;
