const { Server } = require('socket.io');
const config = require('./config');
const { verifyAccessToken } = require('./utils/jwt');

let io = null;

/**
 * Initialize Socket.io on an HTTP server with JWT handshake authentication.
 * @param {import('http').Server} httpServer
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    try {
      const decoded = verifyAccessToken(token);
      socket.user = {
        id: decoded.sub,
        email: decoded.email,
        role: decoded.role,
        driverId: decoded.driverId || null,
      };
      return next();
    } catch (_err) {
      return next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const { role, driverId } = socket.user;

    if (role === 'admin') {
      socket.join('admin');
    }
    if (role === 'driver' && driverId) {
      socket.join(`trip:${driverId}`);
    }

    socket.on('join:trip', (tripId) => {
      if (typeof tripId === 'string' && tripId.trim()) {
        socket.join(`trip:${tripId.trim()}`);
      }
    });

    socket.on('join:room', (room) => {
      if (typeof room === 'string' && room.trim()) {
        socket.join(room.trim());
      }
    });
  });

  return io;
}

function getIO() {
  return io;
}

/**
 * Emit an event to a Socket.io room (no-op when IO is not initialized, e.g. in tests).
 */
function emitToRoom(room, event, payload) {
  if (io) {
    io.to(room).emit(event, payload);
  }
}

module.exports = {
  initSocket,
  getIO,
  emitToRoom,
};
