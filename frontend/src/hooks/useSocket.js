// useSocket — connects to Socket.IO and joins the correct room based on user role
// Call once at the app root level (App.jsx)
import { useEffect } from 'react';
import socket from '../lib/socket';
import useAuthStore from '../stores/authStore';
import useAdminAuthStore from '../stores/adminAuthStore';

const useSocket = () => {
  const customerUser = useAuthStore((s) => s.user);
  const adminUser    = useAdminAuthStore((s) => s.user);

  useEffect(() => {
    // Connect if either session is active
    if (!customerUser && !adminUser) {
      socket.disconnect();
      return;
    }

    if (!socket.connected) socket.connect();

    socket.once('connect', () => {
      if (adminUser) {
        socket.emit('join', 'admin');
      }
      if (customerUser) {
        socket.emit('join', `user_${customerUser.id}`);
        socket.emit('join', 'customer');
      }
    });

    // Re-join if already connected
    if (socket.connected) {
      if (adminUser)    socket.emit('join', 'admin');
      if (customerUser) {
        socket.emit('join', `user_${customerUser.id}`);
        socket.emit('join', 'customer');
      }
    }

    return () => {
      // Don't disconnect on cleanup — keep socket alive across route changes
    };
  }, [customerUser?.id, adminUser?.id]);
};

export default useSocket;
