import { Server } from 'socket.io';
import { ChatSession } from '../models/ChatSession.js';
import { ChatMessage } from '../models/ChatMessage.js';

// Maps visitorId -> socket.id so replies can reach the right visitor
const visitorSockets = new Map();

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    const role = socket.handshake.query?.role || 'visitor';
    const username = socket.handshake.query?.username || '';

    // ---- VISITOR side ----
    if (role === 'visitor') {
      socket.on('visitor:join', (visitorId) => {
        visitorSockets.set(visitorId, socket.id);
        socket.join(`visitor:${visitorId}`);
      });

      socket.on('visitor:message', async (payload) => {
        const { visitorId, text } = payload || {};
        if (!visitorId || !text || !text.trim()) return;
        try {
          let session = await ChatSession.findOne({ visitorId });
          if (!session) {
            session = await ChatSession.create({ visitorId, visitorName: 'Visitor', visitorEmail: '' });
          }

          const message = await ChatMessage.create({
            sessionId: session._id,
            sender: 'visitor',
            senderName: session.visitorName || 'Visitor',
            text: text.trim()
          });

          session.lastMessageAt = new Date();
          session.unreadByAdmin = (session.unreadByAdmin || 0) + 1;
          await session.save();

          const payloadOut = message.toObject ? message.toObject() : message;
          socket.emit('chat:message', payloadOut);
          io.to('admins').emit('admin:message', { session: session.toObject(), message: payloadOut });
        } catch (err) {
          console.error('visitor:message error:', err);
        }
      });

      socket.on('visitor:typing', (payload) => {
        const { visitorId, typing } = payload || {};
        io.to('admins').emit('admin:typing', { visitorId, typing });
      });
    }

    // ---- TEAM (admin/mentor) side ----
    if (role === 'admin' || role === 'mentor') {
      socket.join('admins');

      socket.on('admin:join', (sessionId) => {
        socket.join(`session:${sessionId}`);
      });

      socket.on('admin:message', async (payload) => {
        const { sessionId, text, visitorId, senderName } = payload || {};
        if (!sessionId || !text || !text.trim()) return;
        try {
          const message = await ChatMessage.create({
            sessionId,
            sender: 'admin',
            senderName: senderName || username || 'Team',
            text: text.trim()
          });

          const session = await ChatSession.findById(sessionId);
          if (session) {
            session.lastMessageAt = new Date();
            await session.save();
          }

          const payloadOut = message.toObject ? message.toObject() : message;

          // Deliver to the admin room and to the specific visitor
          io.to(`session:${sessionId}`).emit('chat:message', payloadOut);
          if (visitorId) {
            const targetSocketId = visitorSockets.get(visitorId);
            if (targetSocketId) {
              io.to(targetSocketId).emit('chat:message', payloadOut);
            }
          }
        } catch (err) {
          console.error('admin:message error:', err);
        }
      });

      socket.on('admin:typing', (payload) => {
        const { visitorId, typing } = payload || {};
        if (visitorId) {
          const targetSocketId = visitorSockets.get(visitorId);
          if (targetSocketId) {
            io.to(targetSocketId).emit('chat:typing', { typing });
          }
        }
      });
    }

    socket.on('disconnect', () => {
      for (const [visitorId, socketId] of visitorSockets.entries()) {
        if (socketId === socket.id) visitorSockets.delete(visitorId);
      }
    });
  });

  return io;
}
