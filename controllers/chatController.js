import { ChatSession } from '../models/ChatSession.js';
import { ChatMessage } from '../models/ChatMessage.js';
import { getUserContext } from '../middleware/auth.js';

// Create or fetch the visitor's session (public — called when the widget opens)
export async function getOrCreateSession(req, res) {
  const { visitorId, visitorName, visitorEmail } = req.body || {};
  try {
    if (!visitorId) {
      return res.status(400).json({ error: 'visitorId is required' });
    }
    let session = await ChatSession.findOne({ visitorId });
    if (!session) {
      session = await ChatSession.create({
        visitorId,
        visitorName: visitorName || 'Visitor',
        visitorEmail: visitorEmail || ''
      });
    } else {
      if (visitorName) session.visitorName = visitorName;
      if (visitorEmail) session.visitorEmail = visitorEmail;
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
  try {
    if (!visitorId) return res.status(400).json({ error: 'visitorId is required' });
    const session = await ChatSession.findOne({ visitorId });
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
  try {
    const sessions = await ChatSession.find().sort({ lastMessageAt: -1 });
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
