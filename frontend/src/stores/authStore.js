// Zustand auth store — persisted to localStorage (customer session only)
import { create } from 'zustand';
import api from '../lib/api';

// Lazy import to avoid circular deps
let _useDataStore = null;
const getDataStore = async () => {
  if (!_useDataStore) {
    const m = await import('./dataStore');
    _useDataStore = m.default;
  }
  return _useDataStore;
};

// ── One-time migration from old keys → new customer keys ──────────────────────
// Users who were logged in before the key rename will still be logged in
// Only migrate if the old session belongs to a CUSTOMER (not ADMIN)
const migrateOldSession = () => {
  const oldToken = localStorage.getItem('zouq_token');
  const oldUser  = localStorage.getItem('zouq_user');
  if (oldToken && !localStorage.getItem('zouq_customer_token')) {
    try {
      const parsed = JSON.parse(oldUser || 'null');
      // Only migrate customer accounts — admin accounts handled by adminAuthStore
      if (parsed?.role !== 'ADMIN') {
        localStorage.setItem('zouq_customer_token', oldToken);
        if (oldUser) localStorage.setItem('zouq_customer_user', oldUser);
      }
    } catch { /* ignore parse errors */ }
  }
  // Clean up old keys regardless
  localStorage.removeItem('zouq_token');
  localStorage.removeItem('zouq_user');
};
migrateOldSession();

// If somehow an ADMIN user ended up in the customer store, clear it
const storedCustomerUser = (() => {
  try {
    const parsed = JSON.parse(localStorage.getItem('zouq_customer_user') || 'null');
    if (parsed?.role === 'ADMIN') {
      localStorage.removeItem('zouq_customer_user');
      localStorage.removeItem('zouq_customer_token');
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
})();

const storedCustomerToken = storedCustomerUser
  ? localStorage.getItem('zouq_customer_token')
  : null;

const useAuthStore = create((set, get) => ({
  user: storedCustomerUser,
  token: storedCustomerToken,
  isLoading: false,
  error: null,

  // ── Login ──────────────────────────────────────────────────────────────────
  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post('/auth/login', credentials);
      const { user, token } = data.data;

      // Admin accounts cannot log in via customer portal
      if (user.role === 'ADMIN') {
        set({ isLoading: false, error: 'Admin accounts must use the admin login page.' });
        return { success: false, message: 'Admin accounts must use the admin login page.' };
      }

      localStorage.setItem('zouq_customer_token', token);
      localStorage.setItem('zouq_customer_user', JSON.stringify(user));
      set({ user, token, isLoading: false });
      return { success: true };
    } catch (err) {
      set({ isLoading: false, error: err.message });
      return { success: false, message: err.message };
    }
  },

  // ── Signup ─────────────────────────────────────────────────────────────────
  signup: async (userData) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post('/auth/signup', userData);
      const { user, token } = data.data;

      localStorage.setItem('zouq_customer_token', token);
      localStorage.setItem('zouq_customer_user', JSON.stringify(user));
      set({ user, token, isLoading: false });
      return { success: true };
    } catch (err) {
      set({ isLoading: false, error: err.message });
      return { success: false, message: err.message };
    }
  },

  // ── Logout ─────────────────────────────────────────────────────────────────
  logout: () => {
    localStorage.removeItem('zouq_customer_token');
    localStorage.removeItem('zouq_customer_user');
    localStorage.removeItem('zouq_cart');
    localStorage.removeItem('zouq_favorites');
    set({ user: null, token: null });
    // Reset dataStore cache so next user gets fresh data
    getDataStore().then((store) => {
      store.setState({ hasFetched: false, categories: [], products: [] });
    }).catch(() => {});
  },

  // ── Refresh user from server ───────────────────────────────────────────────
  fetchMe: async () => {
    try {
      const { data } = await api.get('/auth/me');
      const user = data.data.user;

      // Admin user should never be in customer store
      if (user.role === 'ADMIN') {
        get().logout();
        return;
      }

      localStorage.setItem('zouq_customer_user', JSON.stringify(user));
      set({ user });
    } catch {
      get().logout();
    }
  },

  // ── Update profile locally after patch ────────────────────────────────────
  updateUser: (updatedUser) => {
    const merged = { ...get().user, ...updatedUser };
    localStorage.setItem('zouq_customer_user', JSON.stringify(merged));
    set({ user: merged });
  },

  isAuthenticated: () => !!get().token,
  isAdmin: () => get().user?.role === 'ADMIN',
}));

export default useAuthStore;
