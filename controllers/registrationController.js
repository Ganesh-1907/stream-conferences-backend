import { Registration } from '../models/Registration.js';
import { Conference } from '../models/Conference.js';
import { Webinar } from '../models/Webinar.js';
import { sendMail } from '../services/mail.js';

const REGISTRATION_BASE = process.env.REGISTRATION_BASE || 'http://localhost:5174/register';

function registrationLink(event) {
  return `${REGISTRATION_BASE}?event=${encodeURIComponent(event?.eventSlug || event?.eventCustomId || event?.eventId || '')}`;
}

async function resolveEvent(eventId, eventType) {
  if (eventType === 'webinar') {
    const webinar = await Webinar.findById(eventId).select('title slug _id eventDate').lean();
    if (!webinar) return null;
    return { eventId: webinar._id.toString(), eventType: 'webinar', eventTitle: webinar.title, eventSlug: webinar.slug };
  }
  const conf = await Conference.findById(eventId).select('title slug _id eventDate').lean();
  if (!conf) return null;
  return { eventId: conf._id.toString(), eventType: 'conference', eventTitle: conf.title, eventSlug: conf.slug };
}

export async function listRegistrations(req, res) {
  const { eventId, eventType } = req.query;
  try {
    const query = {};
    if (eventId) query.eventId = eventId;
    if (eventType) query.eventType = eventType;
    const list = await Registration.find(query).sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    console.error('Fetch registrations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function registerParticipant(req, res) {
  const { name, email, phone, institution, country, category, presentingAbstract, eventId, eventType, eventSlug } = req.body;
  try {
    if (!name || !email || !institution || !country || !category) {
      return res.status(400).json({ error: 'Missing required registration fields' });
    }

    let event = null;
    if (eventId) {
      const type = eventType || 'conference';
      event = await resolveEvent(eventId, type);
    } else if (eventSlug) {
      // resolve by slug across conference + webinar
      event = await resolveBySlug(eventSlug);
    }

    const item = await Registration.create({
      name,
      email,
      phone,
      institution,
      country,
      category,
      presentingAbstract,
      eventId: event?.eventId || null,
      eventType: event?.eventType || null,
      eventTitle: event?.eventTitle || null,
      eventSlug: event?.eventSlug || null
    });

    const link = event ? registrationLink(event) : null;
    const registrationHtml = link
      ? `<p>Complete your registration here: <a href="${link}">${link}</a></p>`
      : `<p>Your registration has been recorded. Our secretariat will contact you with further details.</p>`;

    await sendMail({
      to: email,
      subject: `Registration received${event?.eventTitle ? ` — ${event.eventTitle}` : ''}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;">
          <h2 style="color: #0e7490;">Thank you for registering</h2>
          <p>Hi ${name},</p>
          <p>We have received your registration${event?.eventTitle ? ` for <strong>${event.eventTitle}</strong>` : ''}.</p>
          ${registrationHtml}
          <p style="color: #666; font-size: 13px;">Your registration is confirmed once payment is completed. Keep this email for your records.</p>
        </div>
      `,
      text: `Hi ${name},\n\nThank you for registering${event?.eventTitle ? ` for ${event.eventTitle}` : ''}.\n${link ? `Complete your registration here: ${link}` : 'Our secretariat will contact you with further details.'}\n`
    });

    res.status(201).json(item);
  } catch (error) {
    console.error('Create registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function resolveBySlug(slugOrId) {
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(slugOrId);
  if (isObjectId) {
    const conf = await Conference.findById(slugOrId).select('title slug _id eventId').lean();
    if (conf) return { eventId: conf._id.toString(), eventType: 'conference', eventTitle: conf.title, eventSlug: conf.slug, eventCustomId: conf.eventId };
    const web = await Webinar.findById(slugOrId).select('title slug _id eventId').lean();
    if (web) return { eventId: web._id.toString(), eventType: 'webinar', eventTitle: web.title, eventSlug: web.slug, eventCustomId: web.eventId };
  } else {
    const caseInsensitiveRegex = new RegExp(`^${slugOrId}$`, 'i');
    const conf = await Conference.findOne({
      $or: [
        { eventId: caseInsensitiveRegex },
        { slug: slugOrId }
      ]
    }).select('title slug _id eventId').lean();
    if (conf) return { eventId: conf._id.toString(), eventType: 'conference', eventTitle: conf.title, eventSlug: conf.slug, eventCustomId: conf.eventId };

    const web = await Webinar.findOne({
      $or: [
        { eventId: caseInsensitiveRegex },
        { slug: slugOrId }
      ]
    }).select('title slug _id eventId').lean();
    if (web) return { eventId: web._id.toString(), eventType: 'webinar', eventTitle: web.title, eventSlug: web.slug, eventCustomId: web.eventId };
  }
  return null;
}

// Resolve a registration link/slug to the underlying event (for the user website)
export async function resolveRegistrationLink(req, res) {
  const { slug } = req.params;
  try {
    const event = await resolveBySlug(slug);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(event);
  } catch (error) {
    console.error('Resolve registration link error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
