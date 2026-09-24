import { Server } from 'socket.io';
import { ChatSession } from '../models/ChatSession.js';
import { ChatMessage } from '../models/ChatMessage.js';

// Maps visitorId -> socket.id so replies can reach the right visitor
const visitorSockets = new Map();
let ioInstance = null;

export function getIO() {
  return ioInstance;
}

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });
  ioInstance = io;

  io.on('connection', (socket) => {
    const role = socket.handshake.query?.role || 'visitor';
    const username = socket.handshake.query?.username || '';

    // ---- VISITOR side ----
    if (role === 'visitor') {
      socket.on('visitor:join', async (data) => {
        const visitorId = typeof data === 'string' ? data : data?.visitorId;
        const conferenceId = typeof data === 'object' ? data?.conferenceId || null : null;
        if (!visitorId) return;
        visitorSockets.set(visitorId, socket.id);
        socket.join(`visitor:${visitorId}`);

        if (typeof data === 'object' && (data.visitorName || data.conferenceId || data.eventId)) {
          try {
            let session = await ChatSession.findOne({ visitorId, conferenceId: conferenceId || null });
            if (!session && (conferenceId || data.eventId || data.conferenceTitle)) {
              session = await ChatSession.findOne({
                visitorId,
                $or: [
                  ...(conferenceId ? [{ conferenceId }] : []),
                  ...(data.eventId ? [{ eventId: data.eventId }] : []),
                  ...(data.conferenceTitle ? [{ conferenceTitle: data.conferenceTitle }] : []),
                  { conferenceId: null },
                  { conferenceId: '' }
                ]
              });
            }
            if (session) {
              if (conferenceId && !session.conferenceId) session.conferenceId = conferenceId;
              if (data.visitorName) session.visitorName = data.visitorName;
              if (data.visitorEmail) session.visitorEmail = data.visitorEmail;
              if (data.visitorPhone) session.visitorPhone = data.visitorPhone;
              if (data.visitorCountry) session.visitorCountry = data.visitorCountry;
              if (data.eventId) session.eventId = data.eventId;
              if (data.conferenceTitle) session.conferenceTitle = data.conferenceTitle;
              await session.save();
              io.to('admins').emit('admin:sessionUpdated', session.toObject());
            }
          } catch (e) {
            console.error('visitor:join details update error:', e);
          }
        }
      });

      socket.on('visitor:updateDetails', async (details) => {
        const { visitorId, visitorName, visitorEmail, visitorPhone, visitorCountry, conferenceId, eventId, conferenceTitle } = details || {};
        if (!visitorId) return;
        try {
          const confId = conferenceId || null;
          const scope = confId ? 'conference' : 'main';
          let session = await ChatSession.findOne({ visitorId, conferenceId: confId });
          if (!session && (confId || eventId || conferenceTitle)) {
            session = await ChatSession.findOne({
              visitorId,
              $or: [
                ...(confId ? [{ conferenceId: confId }] : []),
                ...(eventId ? [{ eventId: eventId }] : []),
                ...(conferenceTitle ? [{ conferenceTitle: conferenceTitle }] : []),
                { conferenceId: null },
                { conferenceId: '' }
              ]
            });
          }

          if (!session) {
            session = await ChatSession.create({
              visitorId,
              conferenceId: confId,
              eventId: eventId || null,
              conferenceTitle: conferenceTitle || '',
              scope,
              visitorName: visitorName || 'Visitor',
              visitorEmail: visitorEmail || '',
              visitorPhone: visitorPhone || '',
              visitorCountry: visitorCountry || ''
            });
          } else {
            if (confId && !session.conferenceId) session.conferenceId = confId;
            if (visitorName) session.visitorName = visitorName;
            if (visitorEmail !== undefined) session.visitorEmail = visitorEmail;
            if (visitorPhone !== undefined) session.visitorPhone = visitorPhone;
            if (visitorCountry !== undefined) session.visitorCountry = visitorCountry;
            if (eventId) session.eventId = eventId;
            if (conferenceTitle) session.conferenceTitle = conferenceTitle;
            if (scope) session.scope = scope;
            await session.save();
          }
          io.to('admins').emit('admin:sessionUpdated', session.toObject());
        } catch (err) {
          console.error('visitor:updateDetails error:', err);
        }
      });

      socket.on('visitor:message', async (payload) => {
        const { visitorId, text, visitorName, visitorEmail, visitorPhone, visitorCountry, conferenceId, eventId, conferenceTitle } = payload || {};
        if (!visitorId || !text || !text.trim()) return;
        try {
          const confId = conferenceId || null;
          const scope = confId ? 'conference' : 'main';
          let session = await ChatSession.findOne({ visitorId, conferenceId: confId });
          if (!session && (confId || eventId || conferenceTitle)) {
            session = await ChatSession.findOne({
              visitorId,
              $or: [
                ...(confId ? [{ conferenceId: confId }] : []),
                ...(eventId ? [{ eventId: eventId }] : []),
                ...(conferenceTitle ? [{ conferenceTitle: conferenceTitle }] : []),
                { conferenceId: null },
                { conferenceId: '' }
              ]
            });
          }

          if (!session) {
            session = await ChatSession.create({
              visitorId,
              conferenceId: confId,
              eventId: eventId || null,
              conferenceTitle: conferenceTitle || '',
              scope,
              visitorName: visitorName || 'Visitor',
              visitorEmail: visitorEmail || '',
              visitorPhone: visitorPhone || '',
              visitorCountry: visitorCountry || ''
            });
          } else {
            let updated = false;
            if (confId && !session.conferenceId) { session.conferenceId = confId; updated = true; }
            if (visitorName && session.visitorName !== visitorName) { session.visitorName = visitorName; updated = true; }
            if (visitorEmail && session.visitorEmail !== visitorEmail) { session.visitorEmail = visitorEmail; updated = true; }
            if (visitorPhone && session.visitorPhone !== visitorPhone) { session.visitorPhone = visitorPhone; updated = true; }
            if (visitorCountry && session.visitorCountry !== visitorCountry) { session.visitorCountry = visitorCountry; updated = true; }
            if (eventId && session.eventId !== eventId) { session.eventId = eventId; updated = true; }
            if (conferenceTitle && session.conferenceTitle !== conferenceTitle) { session.conferenceTitle = conferenceTitle; updated = true; }
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
        const { visitorId, typing, conferenceId } = payload || {};
        io.to('admins').emit('admin:typing', { visitorId, typing, conferenceId });
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
          const targetVisitorId = visitorId || session?.visitorId;

          // Deliver to admin rooms, session room, and to the specific visitor
          io.to(`session:${sessionId}`).emit('chat:message', payloadOut);
          io.to('admins').emit('chat:message', payloadOut);
          if (targetVisitorId) {
            io.to(`visitor:${targetVisitorId}`).emit('chat:message', payloadOut);
            const targetSocketId = visitorSockets.get(targetVisitorId);
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
