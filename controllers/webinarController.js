import { Webinar } from '../models/Webinar.js';
import { Registration } from '../models/Registration.js';
import { Order } from '../models/Order.js';
import { Abstract } from '../models/Abstract.js';
import { Contact } from '../models/Contact.js';
import { getUserContext } from '../middleware/auth.js';
import { generateSlug } from '../services/slug.js';

const REGISTRATION_BASE = process.env.REGISTRATION_BASE || 'http://localhost:5174/register';

function registrationLink(event) {
  return `${REGISTRATION_BASE}?event=${encodeURIComponent(event.eventId || event.slug)}`;
}

export async function listWebinars(req, res) {
  const { role, username } = getUserContext(req);
  try {
    let query = {};
    if (role === 'mentor' && username) {
      query = { announcedBy: username };
    }
    const list = await Webinar.find(query).sort({ eventDate: 1 });
    res.json(list.map(w => ({ ...w.toJSON(), registrationLink: registrationLink(w) })));
  } catch (error) {
    console.error('Fetch webinars error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getWebinar(req, res) {
  const { id } = req.params;
  try {
    const item = await Webinar.findById(id);
    if (!item) {
      return res.status(404).json({ error: 'Webinar not found' });
    }
    res.json({ ...item.toJSON(), registrationLink: registrationLink(item) });
  } catch (error) {
    console.error('Get webinar error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createWebinar(req, res) {
  const { username } = getUserContext(req);
  const {
    title, description, day, month, location, eventDate, speaker, slug,
    startTime, endTime, brochureUrl, bannerUrl, logoUrl, fees, tracks, organizerContact
  } = req.body;
  try {
    if (!title || !day || !month || !location || !eventDate || !speaker) {
      return res.status(400).json({ error: 'Missing required webinar fields (title, day, month, location, eventDate, speaker)' });
    }
    const item = await Webinar.create({
      title,
      description,
      day,
      month,
      location,
      eventDate: new Date(eventDate),
      speaker,
      slug: slug || generateSlug(title, 'web'),
      startTime,
      endTime,
      brochureUrl,
      bannerUrl,
      logoUrl,
      fees: Array.isArray(fees) ? fees : [],
      tracks: Array.isArray(tracks) ? tracks : [],
      organizerContact: organizerContact || {},
      announcedBy: username
    });
    res.status(201).json({ ...item.toJSON(), registrationLink: registrationLink(item) });
  } catch (error) {
    console.error('Create webinar error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateWebinar(req, res) {
  const { role, username } = getUserContext(req);
  const { id } = req.params;
  const {
    title, description, day, month, location, eventDate, speaker, slug,
    startTime, endTime, brochureUrl, bannerUrl, logoUrl, fees, tracks, organizerContact
  } = req.body;
  try {
    const item = await Webinar.findById(id);
    if (!item) {
      return res.status(404).json({ error: 'Webinar not found' });
    }
    if (role === 'mentor' && item.announcedBy !== username) {
      return res.status(403).json({ error: 'Forbidden: Cannot edit another user\'s webinar' });
    }

    item.title = title ?? item.title;
    item.description = description ?? item.description;
    item.day = day ?? item.day;
    item.month = month ?? item.month;
    item.location = location ?? item.location;
    if (eventDate) item.eventDate = new Date(eventDate);
    item.speaker = speaker ?? item.speaker;
    if (slug) item.slug = slug;
    if (startTime !== undefined) item.startTime = startTime;
    if (endTime !== undefined) item.endTime = endTime;
    if (brochureUrl !== undefined) item.brochureUrl = brochureUrl;
    if (bannerUrl !== undefined) item.bannerUrl = bannerUrl;
    if (logoUrl !== undefined) item.logoUrl = logoUrl;
    if (fees !== undefined) item.fees = Array.isArray(fees) ? fees : [];
    if (tracks !== undefined) item.tracks = Array.isArray(tracks) ? tracks : [];
    if (organizerContact !== undefined) item.organizerContact = organizerContact;

    await item.save();
    res.json({ ...item.toJSON(), registrationLink: registrationLink(item) });
  } catch (error) {
    console.error('Update webinar error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteWebinar(req, res) {
  const { role, username } = getUserContext(req);
  const { id } = req.params;
  try {
    const item = await Webinar.findById(id);
    if (!item) {
      return res.status(404).json({ error: 'Webinar not found' });
    }
    if (role === 'mentor' && item.announcedBy !== username) {
      return res.status(403).json({ error: 'Forbidden: Cannot delete another user\'s webinar' });
    }
    await Webinar.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete webinar error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Per-event participants registered for this webinar
export async function getWebinarParticipants(req, res) {
  const { role, username } = getUserContext(req);
  const { id } = req.params;
  try {
    const event = await Webinar.findById(id);
    if (!event) {
      return res.status(404).json({ error: 'Webinar not found' });
    }
    if (role === 'mentor' && event.announcedBy !== username) {
      return res.status(403).json({ error: 'Forbidden: Cannot view another user\'s webinar participants' });
    }
    const participants = await Registration.find({ eventId: id, eventType: 'webinar' }).sort({ createdAt: -1 });
    const payments = await Order.find({ eventId: id, eventType: 'webinar' }).sort({ createdAt: -1 });
    const paid = payments.filter(p => p.status === 'paid');
    const revenuePaise = paid.reduce((sum, p) => sum + (p.amount || 0), 0);
    res.json({
      eventId: id,
      stats: {
        totalParticipants: participants.length,
        totalPayments: payments.length,
        paidCount: paid.length,
        pendingCount: payments.filter(p => p.status === 'pending').length,
        failedCount: payments.filter(p => p.status === 'failed').length,
        revenuePaise,
        revenue: (revenuePaise / 100).toFixed(2)
      },
      participants,
      payments
    });
  } catch (error) {
    console.error('Get webinar participants error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Abstracts submitted against this webinar
export async function getWebinarAbstracts(req, res) {
  const { role, username } = getUserContext(req);
  const { id } = req.params;
  try {
    const event = await Webinar.findById(id);
    if (!event) return res.status(404).json({ error: 'Webinar not found' });
    if (role === 'mentor' && event.announcedBy !== username) {
      return res.status(403).json({ error: 'Forbidden: Cannot view another user\'s webinar abstracts' });
    }
    const list = await Abstract.find({ eventId: id, eventType: 'webinar' }).sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    console.error('Get webinar abstracts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Enquiries received for this webinar
export async function getWebinarEnquiries(req, res) {
  const { role, username } = getUserContext(req);
  const { id } = req.params;
  try {
    const event = await Webinar.findById(id);
    if (!event) return res.status(404).json({ error: 'Webinar not found' });
    if (role === 'mentor' && event.announcedBy !== username) {
      return res.status(403).json({ error: 'Forbidden: Cannot view another user\'s webinar enquiries' });
    }
    const list = await Contact.find({ eventId: id, eventType: 'webinar' }).sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    console.error('Get webinar enquiries error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
