import { Conference } from '../models/Conference.js';
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

export async function listConferences(req, res) {
  const { role, username } = getUserContext(req);
  try {
    let query = {};
    if (role === 'mentor' && username) {
      query = { announcedBy: username };
    }
    const list = await Conference.find(query).sort({ eventDate: 1 });
    res.json(list.map(c => ({ ...c.toJSON(), registrationLink: registrationLink(c) })));
  } catch (error) {
    console.error('Fetch conferences error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getConference(req, res) {
  const { id } = req.params;
  try {
    const item = await Conference.findById(id);
    if (!item) {
      return res.status(404).json({ error: 'Conference not found' });
    }
    res.json({ ...item.toJSON(), registrationLink: registrationLink(item) });
  } catch (error) {
    console.error('Get conference error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createConference(req, res) {
  const { username } = getUserContext(req);
  const {
    title, description, day, month, location, eventDate, slug,
    startTime, endTime, brochureUrl, bannerUrl, logoUrl, fees, tracks, organizerContact
  } = req.body;
  try {
    if (!title || !day || !month || !location || !eventDate) {
      return res.status(400).json({ error: 'Missing required conference fields (title, day, month, location, eventDate)' });
    }
    const item = await Conference.create({
      title,
      description,
      day,
      month,
      location,
      eventDate: new Date(eventDate),
      slug: slug || generateSlug(title, 'conf'),
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
    console.error('Create conference error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateConference(req, res) {
  const { role, username } = getUserContext(req);
  const { id } = req.params;
  const {
    title, description, day, month, location, eventDate, slug,
    startTime, endTime, brochureUrl, bannerUrl, logoUrl, fees, tracks, organizerContact
  } = req.body;
  try {
    const item = await Conference.findById(id);
    if (!item) {
      return res.status(404).json({ error: 'Conference not found' });
    }
    if (role === 'mentor' && item.announcedBy !== username) {
      return res.status(403).json({ error: 'Forbidden: Cannot edit another user\'s conference' });
    }

    item.title = title ?? item.title;
    item.description = description ?? item.description;
    item.day = day ?? item.day;
    item.month = month ?? item.month;
    item.location = location ?? item.location;
    if (eventDate) item.eventDate = new Date(eventDate);
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
    console.error('Update conference error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteConference(req, res) {
  const { role, username } = getUserContext(req);
  const { id } = req.params;
  try {
    const item = await Conference.findById(id);
    if (!item) {
      return res.status(404).json({ error: 'Conference not found' });
    }
    if (role === 'mentor' && item.announcedBy !== username) {
      return res.status(403).json({ error: 'Forbidden: Cannot delete another user\'s conference' });
    }
    await Conference.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete conference error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Per-event participants registered for this conference
export async function getConferenceParticipants(req, res) {
  const { role, username } = getUserContext(req);
  const { id } = req.params;
  try {
    const event = await Conference.findById(id);
    if (!event) {
      return res.status(404).json({ error: 'Conference not found' });
    }
    if (role === 'mentor' && event.announcedBy !== username) {
      return res.status(403).json({ error: 'Forbidden: Cannot view another user\'s conference participants' });
    }
    const participants = await Registration.find({ eventId: id, eventType: 'conference' }).sort({ createdAt: -1 });
    const payments = await Order.find({ eventId: id, eventType: 'conference' }).sort({ createdAt: -1 });
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
    console.error('Get conference participants error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Abstracts submitted against this conference
export async function getConferenceAbstracts(req, res) {
  const { role, username } = getUserContext(req);
  const { id } = req.params;
  try {
    const event = await Conference.findById(id);
    if (!event) return res.status(404).json({ error: 'Conference not found' });
    if (role === 'mentor' && event.announcedBy !== username) {
      return res.status(403).json({ error: 'Forbidden: Cannot view another user\'s conference abstracts' });
    }
    const list = await Abstract.find({ eventId: id, eventType: 'conference' }).sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    console.error('Get conference abstracts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Enquiries received for this conference
export async function getConferenceEnquiries(req, res) {
  const { role, username } = getUserContext(req);
  const { id } = req.params;
  try {
    const event = await Conference.findById(id);
    if (!event) return res.status(404).json({ error: 'Conference not found' });
    if (role === 'mentor' && event.announcedBy !== username) {
      return res.status(403).json({ error: 'Forbidden: Cannot view another user\'s conference enquiries' });
    }
    const list = await Contact.find({ eventId: id, eventType: 'conference' }).sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    console.error('Get conference enquiries error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
