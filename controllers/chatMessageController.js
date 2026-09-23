import { ChatMessage } from '../models/ChatMessage.js';
import { Conference } from '../models/Conference.js';
import { Webinar } from '../models/Webinar.js';

// GET /api/chat-messages?conferenceId=...
export async function getChatMessages(req, res) {
  const { conferenceId } = req.query;
  try {
    let query = {};
    if (conferenceId) {
      const isObjectId = typeof conferenceId === 'string' && /^[0-9a-fA-F]{24}$/.test(conferenceId);
      const searchConditions = [
        isObjectId ? { _id: conferenceId } : null,
        { eventId: conferenceId },
        { slug: conferenceId }
      ].filter(Boolean);

      const conf = await Conference.findOne({ $or: searchConditions }) || await Webinar.findOne({ $or: searchConditions });

      if (conf) {
        const ids = [conf._id.toString(), conf.eventId, conf.slug].filter(Boolean);
        query = { conferenceId: { $in: ids } };
      } else {
        query = { conferenceId };
      }
    }

    const messages = await ChatMessage.find(query).sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    console.error('Fetch chat messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/chat-messages
export async function createChatMessage(req, res) {
  const { conferenceId, senderName, senderEmail, senderPhone, senderCountry, senderRole, message, text, sender } = req.body || {};
  const msgContent = (message || text || '').trim();
  if (!conferenceId || !msgContent) {
    return res.status(400).json({ error: 'Conference ID and message are required' });
  }
  try {
    const item = await ChatMessage.create({
      conferenceId,
      senderName: senderName || 'Guest Visitor',
      senderEmail: senderEmail || '',
      senderPhone: senderPhone || '',
      senderCountry: senderCountry || '',
      senderRole: senderRole || (sender === 'admin' ? 'admin' : 'attendee'),
      sender: sender || (senderRole === 'admin' ? 'admin' : 'visitor'),
      message: msgContent,
      text: msgContent
    });
    res.status(201).json(item);
  } catch (error) {
    console.error('Create chat message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
