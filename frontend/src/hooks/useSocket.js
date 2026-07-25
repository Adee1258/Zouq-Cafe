// useSocket — connects to Socket.IO and joins the correct room based on user role.
// Rooms are strictly separated: admin joins 'admin' only, customer joins their own rooms.
// This prevents cross-room event leakage if both sessions are somehow active.
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

    const joinRooms = () => {
      // Admin session — only join admin room, never customer rooms
      if (adminUser?.role === 'ADMIN') {
        socket.emit('join', 'admin');
      }
      // Customer session — only join customer rooms, never admin room
      // Also guard: skip if this is an admin user that leaked into customer store
      if (customerUser && customerUser.role !== 'ADMIN') {
        socket.emit('join', `user_${customerUser.id}`);
        socket.emit('join', 'customer');
      }
    };

    socket.once('connect', joinRooms);

    // Re-join if already connected (page navigations, store hydration)
    if (socket.connected) joinRooms();

    return () => {
      // Don't disconnect on cleanup — keep socket alive across route changes
    };
  }, [customerUser?.id, adminUser?.id]);
};

export default useSocket;
