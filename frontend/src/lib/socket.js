// Socket.IO client — single shared connection for the whole app
import { io } from 'socket.io-client';

// Production pe VITE_SOCKET_URL env var set karo (backend Vercel URL)
// e.g. VITE_SOCKET_URL=https://zouq-cafe-backend.vercel.app
// Agar set nahi toh same origin use karo (frontend aur backend same domain pe ho toh)
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 
  (import.meta.env.VITE_API_URL || window.location.origin);

/**
 * Reads the active JWT token from localStorage.
 * Uses the same guard as api.js: /admin/login is an AUTH page,
 * not inside the admin panel — it must never send the admin token.
 */
const getActiveToken = () => {
  const path = window.location.pathname;
  const isInsideAdminPanel = path.startsWith('/admin') && path !== '/admin/login';
  if (isInsideAdminPanel) {
    return localStorage.getItem('zouq_admin_token') || null;
  }
  return localStorage.getItem('zouq_customer_token') || null;
};

const socket = io(SOCKET_URL, {
  autoConnect: false,   // connect manually after we know who the user is
  reconnection: true,
  reconnectionDelay: 2000,
  reconnectionAttempts: 10,
  // Send JWT token in the handshake so server can verify before room joins
  auth: (cb) => {
    cb({ token: getActiveToken() });
  },
});

export default socket;
