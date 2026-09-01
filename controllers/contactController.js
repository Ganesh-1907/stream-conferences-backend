import { Contact } from '../models/Contact.js';
import { Conference } from '../models/Conference.js';
import { Webinar } from '../models/Webinar.js';

async function resolveEvent(eventId, eventType, eventSlug) {
  if (eventId) {
    if (eventType === 'webinar') {
      const w = await Webinar.findById(eventId).select('title slug _id').lean();
      if (w) return { eventId: w._id.toString(), eventType: 'webinar', eventTitle: w.title, eventSlug: w.slug };
    }
    const c = await Conference.findById(eventId).select('title slug _id').lean();
    if (c) return { eventId: c._id.toString(), eventType: 'conference', eventTitle: c.title, eventSlug: c.slug };
  }
  if (eventSlug) {
    const c = await Conference.findOne({ slug: eventSlug }).select('title slug _id').lean();
    if (c) return { eventId: c._id.toString(), eventType: 'conference', eventTitle: c.title, eventSlug: c.slug };
    const w = await Webinar.findOne({ slug: eventSlug }).select('title slug _id').lean();
    if (w) return { eventId: w._id.toString(), eventType: 'webinar', eventTitle: w.title, eventSlug: w.slug };
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
