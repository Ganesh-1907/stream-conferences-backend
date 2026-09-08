import { Contact } from '../models/Contact.js';
import { resolveEventByRef } from '../services/eventResolver.js';

async function resolveEvent(eventId, eventType, eventSlug) {
  if (eventId) {
    const resolved = await resolveEventByRef(eventId);
    if (!resolved) return null;
    if (eventType && resolved.eventType !== eventType) return null;
    return resolved;
  }
  if (eventSlug) {
    return resolveEventByRef(eventSlug);
  }
  return null;
}

export async function listContacts(req, res) {
  try {
    const list = await Contact.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    console.error('Fetch contacts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function sendContact(req, res) {
  const { name, email, phone, subject, conference, message, eventId, eventType, eventSlug } = req.body;
  try {
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Missing required contact fields (name, email, message)' });
    }
    const event = await resolveEvent(eventId, eventType, eventSlug);
    const item = await Contact.create({
      name,
      email,
      phone,
      subject,
      conference,
      message,
      eventId: event?.eventId || null,
      eventType: event?.eventType || null,
      eventTitle: event?.eventTitle || null,
      eventSlug: event?.eventSlug || null
    });
    res.status(201).json({ success: true, id: item._id });
  } catch (error) {
    console.error('Send contact error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
