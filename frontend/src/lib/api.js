import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '/api',
  timeout: 20000,
});

// Attach correct JWT token based on current page context
api.interceptors.request.use((config) => {
  const isAdminPage =
    window.location.pathname.startsWith('/admin');

  const tokenKey = isAdminPage ? 'zouq_admin_token' : 'zouq_customer_token';
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
      const isAdminPage = window.location.pathname.startsWith('/admin');
      const isAuthPage =
        window.location.pathname === '/login' ||
        window.location.pathname === '/signup' ||
        window.location.pathname === '/admin/login';

      if (!isAuthPage) {
        if (isAdminPage) {
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
