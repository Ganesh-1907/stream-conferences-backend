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
      socket.on('visitor:join', async (data) => {
        const visitorId = typeof data === 'string' ? data : data?.visitorId;
        if (!visitorId) return;
        visitorSockets.set(visitorId, socket.id);
        socket.join(`visitor:${visitorId}`);

        if (typeof data === 'object' && data.visitorName) {
          try {
            let session = await ChatSession.findOne({ visitorId });
            if (session) {
              session.visitorName = data.visitorName;
              if (data.visitorEmail) session.visitorEmail = data.visitorEmail;
              if (data.visitorPhone) session.visitorPhone = data.visitorPhone;
              if (data.visitorCountry) session.visitorCountry = data.visitorCountry;
              await session.save();
              io.to('admins').emit('admin:sessionUpdated', session.toObject());
            }
          } catch (e) {
            console.error('visitor:join details update error:', e);
          }
        }
      });

      socket.on('visitor:updateDetails', async (details) => {
        const { visitorId, visitorName, visitorEmail, visitorPhone, visitorCountry } = details || {};
        if (!visitorId) return;
        try {
          let session = await ChatSession.findOne({ visitorId });
          if (!session) {
            session = await ChatSession.create({
              visitorId,
              visitorName: visitorName || 'Visitor',
              visitorEmail: visitorEmail || '',
              visitorPhone: visitorPhone || '',
              visitorCountry: visitorCountry || ''
            });
          } else {
            if (visitorName) session.visitorName = visitorName;
            if (visitorEmail !== undefined) session.visitorEmail = visitorEmail;
            if (visitorPhone !== undefined) session.visitorPhone = visitorPhone;
            if (visitorCountry !== undefined) session.visitorCountry = visitorCountry;
            await session.save();
          }
          io.to('admins').emit('admin:sessionUpdated', session.toObject());
        } catch (err) {
          console.error('visitor:updateDetails error:', err);
        }
      });

      socket.on('visitor:message', async (payload) => {
        const { visitorId, text, visitorName, visitorEmail, visitorPhone, visitorCountry } = payload || {};
        if (!visitorId || !text || !text.trim()) return;
        try {
          let session = await ChatSession.findOne({ visitorId });
          if (!session) {
            session = await ChatSession.create({
              visitorId,
              visitorName: visitorName || 'Visitor',
              visitorEmail: visitorEmail || '',
              visitorPhone: visitorPhone || '',
              visitorCountry: visitorCountry || ''
            });
          } else {
            let updated = false;
            if (visitorName && session.visitorName !== visitorName) { session.visitorName = visitorName; updated = true; }
            if (visitorEmail && session.visitorEmail !== visitorEmail) { session.visitorEmail = visitorEmail; updated = true; }
            if (visitorPhone && session.visitorPhone !== visitorPhone) { session.visitorPhone = visitorPhone; updated = true; }
            if (visitorCountry && session.visitorCountry !== visitorCountry) { session.visitorCountry = visitorCountry; updated = true; }
            if (updated) await session.save();
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
