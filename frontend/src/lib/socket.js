// Socket.IO client — single shared connection for the whole app
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

/**
 * Reads the active JWT token from localStorage.
 * Admin token takes priority when on admin pages.
 */
const getActiveToken = () => {
  const isAdminPage = window.location.pathname.startsWith('/admin');
  if (isAdminPage) {
    return localStorage.getItem('zouq_admin_token') || localStorage.getItem('zouq_customer_token');
  }
  return localStorage.getItem('zouq_customer_token') || localStorage.getItem('zouq_admin_token');
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
