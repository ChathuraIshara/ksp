/**
 * socketServer.js
 *
 * Singleton Socket.io server instance.
 * Initialised once in app.js, then accessed anywhere via getIO().
 *
 * Room strategy:
 *   Each authenticated user joins room "user:{user_id}" on connect.
 *   Notifications are emitted to that room.
 *   Officers also join role rooms: "role:PSO", "role:SW", etc.
 */

const { Server } = require('socket.io');
const jwt        = require('jsonwebtoken');
const env        = require('../config/env');

let _io = null;

/**
 * init — attach Socket.io to the HTTP server and configure auth middleware.
 * Called once from app.js after server.listen().
 */
const init = (httpServer) => {
  _io = new Server(httpServer, {
    cors: {
      origin:      process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
      methods:     ['GET', 'POST'],
      credentials: true,
    },
  });

  // ── Socket.io JWT auth middleware ─────────────────────────────────────────
  _io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || env.jwt.secret);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // ── Connection handler ────────────────────────────────────────────────────
  _io.on('connection', (socket) => {
    const user = socket.user;
    if (!user?.user_id) return;

    // Join personal room
    socket.join(`user:${user.user_id}`);

    // Join role room (for broadcast to all officers of a type)
    if (user.role) socket.join(`role:${user.role}`);

    console.log(`[SOCKET] Connected: ${user.email || user.user_id} (${user.role}) — rooms: user:${user.user_id}, role:${user.role}`);

    socket.on('disconnect', () => {
      console.log(`[SOCKET] Disconnected: ${user.email || user.user_id}`);
    });

    // ── Ping/pong for connection health ────────────────────────────────────
    socket.on('ping', () => socket.emit('pong', { timestamp: Date.now() }));

    // ── Conversation rooms for real-time messaging (FR-07) ─────────────────
    socket.on('join_conversation', ({ conversation_id }) => {
      if (conversation_id) socket.join(`conv:${conversation_id}`);
    });
    socket.on('leave_conversation', ({ conversation_id }) => {
      if (conversation_id) socket.leave(`conv:${conversation_id}`);
    });
  });

  console.log('✅ Socket.io server initialised');
  return _io;
};

const getIO = () => _io;

module.exports = { init, getIO };
