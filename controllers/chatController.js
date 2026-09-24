import { ChatSession } from '../models/ChatSession.js';
import { ChatMessage } from '../models/ChatMessage.js';
import { getUserContext } from '../middleware/auth.js';

// Create or fetch the visitor's session (public — called when the widget opens)
export async function getOrCreateSession(req, res) {
  const {
    visitorId,
    visitorName,
    visitorEmail,
    visitorPhone,
    visitorCountry,
    conferenceId,
    eventId,
    conferenceTitle,
    scope
  } = req.body || {};

  try {
    if (!visitorId) {
      return res.status(400).json({ error: 'visitorId is required' });
    }
    const confId = conferenceId || null;
    const currentScope = scope || (confId ? 'conference' : 'main');

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

    if (!session && visitorEmail && (confId || eventId)) {
      session = await ChatSession.findOne({
        visitorEmail,
        $or: [
          ...(confId ? [{ conferenceId: confId }] : []),
          ...(eventId ? [{ eventId: eventId }] : []),
          { conferenceId: null },
          { conferenceId: '' }
        ]
      });
      if (session) {
        session.visitorId = visitorId;
      }
    }

    if (!session) {
      session = await ChatSession.create({
        visitorId,
        conferenceId: confId,
        eventId: eventId || null,
        conferenceTitle: conferenceTitle || '',
        scope: currentScope,
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
      if (currentScope) session.scope = currentScope;
      await session.save();
    }
    res.json(session);
  } catch (error) {
    console.error('Get/create chat session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Public: fetch a visitor's own session + message history
export async function getVisitorHistory(req, res) {
  const { visitorId } = req.params;
  const conferenceId = req.query.conferenceId || null;
  const eventId = req.query.eventId || null;
  try {
    if (!visitorId) return res.status(400).json({ error: 'visitorId is required' });
    let session = await ChatSession.findOne({ visitorId, conferenceId: conferenceId || null });
    if (!session && (conferenceId || eventId)) {
      session = await ChatSession.findOne({
        visitorId,
        $or: [
          ...(conferenceId ? [{ conferenceId: conferenceId }] : []),
          ...(eventId ? [{ eventId: eventId }] : []),
          { conferenceId: null },
          { conferenceId: '' }
        ]
      });
    }
    if (!session) return res.json({ session: null, messages: [] });
    const messages = await ChatMessage.find({ sessionId: session._id }).sort({ createdAt: 1 });
    res.json({ session, messages });
  } catch (error) {
    console.error('Get visitor chat history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// List sessions for the admin panel (admin or mentor)
export async function listSessions(req, res) {
  const { role } = getUserContext(req);
  if (role !== 'admin' && role !== 'mentor') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { conferenceId, scope, eventId, conferenceTitle } = req.query || {};
  try {
    const filter = {};
    if (conferenceId && conferenceId !== 'all') {
      if (conferenceId === 'main') {
        filter.$or = [{ scope: 'main' }, { conferenceId: null }, { conferenceId: '' }];
      } else {
        const orConditions = [
          { conferenceId: conferenceId },
          { eventId: conferenceId }
        ];
        if (eventId) {
          orConditions.push({ eventId: eventId }, { conferenceId: eventId });
        }
        if (conferenceTitle) {
          orConditions.push({ conferenceTitle: conferenceTitle });
        }
        filter.$or = orConditions;
      }
    } else if (scope === 'main') {
      filter.$or = [{ scope: 'main' }, { conferenceId: null }, { conferenceId: '' }];
    } else if (scope === 'conference') {
      filter.conferenceId = { $ne: null };
    }

    const rawSessions = await ChatSession.find(filter).sort({ lastMessageAt: -1 });
    const seen = new Set();
    const sessions = [];
    for (const s of rawSessions) {
      const dedupKey = s.visitorEmail
        ? `${s.visitorEmail.toLowerCase()}_${s.conferenceId || s.eventId || 'main'}`
        : s.visitorId;
      if (!seen.has(dedupKey)) {
        seen.add(dedupKey);
        sessions.push(s);
      }
    }
    res.json(sessions);
  } catch (error) {
    console.error('List chat sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Fetch message history for a session
export async function getMessages(req, res) {
  const { role } = getUserContext(req);
  if (role !== 'admin' && role !== 'mentor') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { sessionId } = req.params;
  try {
    const session = await ChatSession.findById(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const messages = await ChatMessage.find({ sessionId }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    console.error('Get chat messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Send a message as a team member (REST fallback when socket is unavailable)
export async function sendAdminMessage(req, res) {
  const { role, username } = getUserContext(req);
  if (role !== 'admin' && role !== 'mentor') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { sessionId } = req.params;
  const { text, senderName } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }
  try {
    const session = await ChatSession.findById(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const message = await ChatMessage.create({
      sessionId,
      sender: 'admin',
      senderName: senderName || username || 'Team',
      text: text.trim()
    });

    session.lastMessageAt = new Date();
    await session.save();

    res.status(201).json(message);
  } catch (error) {
    console.error('Send admin message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Mark a session's admin-unread counter as read
export async function markRead(req, res) {
  const { role } = getUserContext(req);
  if (role !== 'admin' && role !== 'mentor') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { sessionId } = req.params;
  try {
    const session = await ChatSession.findByIdAndUpdate(
      sessionId,
      { unreadByAdmin: 0 },
      { new: true }
    );
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (error) {
    console.error('Mark chat read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Resolve (close/reopen) a session
export async function setSessionStatus(req, res) {
  const { role } = getUserContext(req);
  if (role !== 'admin' && role !== 'mentor') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { sessionId } = req.params;
  const { status } = req.body || {};
  if (!['open', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const session = await ChatSession.findByIdAndUpdate(
      sessionId,
      { status },
      { new: true }
    );
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (error) {
    console.error('Set chat session status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Public: visitor sends a message via HTTP endpoint (works even without active socket connection)
export async function sendVisitorMessage(req, res) {
  const {
    visitorId,
    text,
    visitorName,
    visitorEmail,
    visitorPhone,
    visitorCountry,
    conferenceId,
    eventId,
    conferenceTitle,
    scope
  } = req.body || {};

  try {
    if (!visitorId || !text || !text.trim()) {
      return res.status(400).json({ error: 'visitorId and text are required' });
    }

    const confId = conferenceId || null;
    const currentScope = scope || (confId ? 'conference' : 'main');

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
        scope: currentScope,
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
      if (currentScope && session.scope !== currentScope) { session.scope = currentScope; updated = true; }
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

    // Broadcast via socket IO if available
    try {
      const { getIO } = await import('../services/chatSocket.js');
      const io = getIO();
      if (io) {
        io.to('admins').emit('admin:message', { session: session.toObject(), message: payloadOut });
        io.to(`visitor:${visitorId}`).emit('chat:message', payloadOut);
      }
    } catch (ioErr) {
      console.error('Socket broadcast error:', ioErr);
    }

    res.status(201).json({ session, message: payloadOut });
  } catch (error) {
    console.error('Send visitor message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

