// Dedicated Zustand store for admin session — completely isolated from customer store
import { create } from 'zustand';
import api from '../lib/api';

// ── One-time migration: if old token belongs to an ADMIN, move it to admin keys ─
const migrateOldAdminSession = () => {
  const oldToken = localStorage.getItem('zouq_token');
  const oldUser  = localStorage.getItem('zouq_user');
  if (oldToken && oldUser && !localStorage.getItem('zouq_admin_token')) {
    try {
      const parsed = JSON.parse(oldUser);
      if (parsed?.role === 'ADMIN') {
        localStorage.setItem('zouq_admin_token', oldToken);
        localStorage.setItem('zouq_admin_user', oldUser);
        // Remove old keys so authStore migration doesn't pick them up
        localStorage.removeItem('zouq_token');
        localStorage.removeItem('zouq_user');
      }
    } catch { /* ignore parse errors */ }
  }
};
migrateOldAdminSession();

const useAdminAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('zouq_admin_user') || 'null'),
  token: localStorage.getItem('zouq_admin_token') || null,
  isLoading: false,
  error: null,

  // ── Admin Login ────────────────────────────────────────────────────────────
  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post('/auth/admin/login', credentials);
      const { user, token } = data.data;

      localStorage.setItem('zouq_admin_token', token);
      localStorage.setItem('zouq_admin_user', JSON.stringify(user));
      set({ user, token, isLoading: false });
      return { success: true };
    } catch (err) {
      set({ isLoading: false, error: err.message });
      return { success: false, message: err.message };
    }
  },

  // ── Logout ─────────────────────────────────────────────────────────────────
  logout: () => {
    localStorage.removeItem('zouq_admin_token');
    localStorage.removeItem('zouq_admin_user');
    set({ user: null, token: null });
  },

  // ── Refresh admin user from server ────────────────────────────────────────
  fetchMe: async () => {
    try {
      const { data } = await api.get('/auth/me');
      const user = data.data.user;
      localStorage.setItem('zouq_admin_user', JSON.stringify(user));
      set({ user });
    } catch {
      get().logout();
    }
  },

  // ── Update admin profile locally after patch ───────────────────────────────
  updateUser: (updatedUser) => {
    const merged = { ...get().user, ...updatedUser };
    localStorage.setItem('zouq_admin_user', JSON.stringify(merged));
    set({ user: merged });
  },

  isAuthenticated: () => !!get().token,
}));

export default useAdminAuthStore;
