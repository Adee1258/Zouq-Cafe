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
const migrateOldSession = () => {
  const oldToken = localStorage.getItem('zouq_token');
  const oldUser  = localStorage.getItem('zouq_user');
  if (oldToken && !localStorage.getItem('zouq_customer_token')) {
    localStorage.setItem('zouq_customer_token', oldToken);
    if (oldUser) localStorage.setItem('zouq_customer_user', oldUser);
  }
  // Clean up old keys regardless
  localStorage.removeItem('zouq_token');
  localStorage.removeItem('zouq_user');
};
migrateOldSession();

const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('zouq_customer_user') || 'null'),
  token: localStorage.getItem('zouq_customer_token') || null,
  isLoading: false,
  error: null,

  // ── Login ──────────────────────────────────────────────────────────────────
  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post('/auth/login', credentials);
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
