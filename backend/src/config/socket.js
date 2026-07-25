// Socket.IO instance — initialized once in server.js, imported anywhere to emit events
const { Server } = require('socket.io');
const { verifyToken } = require('../utils/jwt');

let io = null;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: [
        process.env.CLIENT_URL || 'http://localhost:5173',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
      ],
      credentials: true,
    },
  });

  // ── Auth middleware — verify JWT before any socket event is processed ──────
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||           // preferred: auth.token
        socket.handshake.headers?.authorization?.split(' ')[1]; // fallback: Bearer header

      if (!token) {
        // Allow unauthenticated connections — they just can't join privileged rooms
        socket.data.user = null;
        return next();
      }

      const decoded = verifyToken(token);
      socket.data.user = { id: decoded.id, role: decoded.role };
      next();
    } catch {
      // Invalid/expired token — treat as unauthenticated (don't block connection)
      socket.data.user = null;
      next();
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;

    socket.on('join', (room) => {
      // ── Customer personal room — must match own user ID ─────────────────
      if (room?.startsWith('user_')) {
        const requestedId = parseInt(room.split('_')[1], 10);
        if (user && user.id === requestedId) {
          socket.join(room);
        }
        return;
      }

      // ── Admin room — ADMIN role required ───────────────────────────────
      if (room === 'admin') {
        if (user && user.role === 'ADMIN') {
          socket.join('admin');
        }
        return;
      }

      // ── General customer room — any authenticated user ──────────────────
      if (room === 'customer') {
        if (user) {
          socket.join('customer');
        }
        return;
      }
    });

    socket.on('disconnect', () => {});
  });

  return io;
};

// Call this anywhere in controllers to emit events
// Returns a no-op emitter when Socket.IO is not initialized (Vercel serverless)
const getIO = () => {
  if (!io) {
    // Graceful fallback — no crash on Vercel serverless
    return {
      to: () => ({ emit: () => {} }),
      emit: () => {},
    };
  }
  return io;
};

module.exports = { initSocket, getIO };
