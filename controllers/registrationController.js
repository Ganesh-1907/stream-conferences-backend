import { Registration } from '../models/Registration.js';
import { Conference } from '../models/Conference.js';
import { Webinar } from '../models/Webinar.js';
import { sendMail } from '../services/mail.js';
import { resolveEventByRef } from '../services/eventResolver.js';
import { registrationLink } from '../services/eventLink.js';
import { emailTemplate } from '../services/emailTemplates.js';

async function resolveEvent(eventId, eventType) {
  if (!eventId) return null;
  const resolved = await resolveEventByRef(eventId);
  if (!resolved) return null;
  if (eventType && resolved.eventType !== eventType) return null;
  return resolved;
}

/** Fetch the full event document for email branding. */
async function fetchFullEvent(eventId, eventType) {
  if (!eventId) return null;
  const Model = eventType === 'webinar' ? Webinar : Conference;
  return Model.findById(eventId).lean();
}

export async function listRegistrations(req, res) {
  const { eventId, eventType, cohortId } = req.query;
  try {
    const query = {};
    if (eventId) query.eventId = eventId;
    if (eventType) query.eventType = eventType;
    if (cohortId) query.cohortId = cohortId;
    const list = await Registration.find(query).sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    console.error('Fetch registrations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function registerParticipant(req, res) {
  const { name, email, phone, institution, country, category, presentingAbstract, eventId, eventType, eventSlug, cohortId } = req.body;
  try {
    if (!name || !email || !institution || !country || !category) {
      return res.status(400).json({ error: 'Missing required registration fields' });
    }

    let event = null;
    if (eventId) {
      const type = eventType || 'conference';
      event = await resolveEvent(eventId, type);
    } else if (eventSlug) {
      event = await resolveEventByRef(eventSlug);
    }

    const fullEvent = await fetchFullEvent(event?.eventId, event?.eventType);

    const item = await Registration.create({
      name,
      email,
      phone,
      institution,
      country,
      category,
      presentingAbstract: presentingAbstract || 'no',
      eventId: event?.eventId || null,
      eventType: event?.eventType || null,
      eventTitle: event?.eventTitle || null,
      eventSlug: event?.eventSlug || null,
      cohortId: cohortId || null
    });

    const link = event ? registrationLink(event) : null;

    // Build fee info for email
    const fees = fullEvent?.fees || [];
    const matchedFee = fees.find((f) => f.type === category);
    const feeHtml = fees.length
      ? `<div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px 18px; margin:18px 0;">
          <strong style="color:#0e7490;">Fee for ${category}:</strong> ${matchedFee ? `$${matchedFee.usd} USD / £${matchedFee.gbp} GBP / €${matchedFee.eur} EUR` : fees[0] ? `$${fees[0].usd} USD` : '—'}
        </div>`
      : '';

    await sendMail({
      to: email,
      subject: `Registration received — ${event?.eventTitle || 'Stream Conferences'}`,
      html: emailTemplate({
        heading: 'Thank you for registering',
        event: fullEvent,
        preheader: `Your registration for ${event?.eventTitle || 'the event'} has been received.`,
        body: `
          <p>Hi ${name},</p>
          <p>We have received your registration for <strong>${event?.eventTitle || 'the event'}</strong> under the <strong>${category}</strong> category.</p>
          ${feeHtml}
          ${link ? `<p style="margin:24px 0;"><a href="${link}" style="display:inline-block; background:#0e7490; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:6px; font-weight:bold;">Complete Payment</a></p>` : `<p>Your registration has been recorded. Our support team will contact you with further details.</p>`}
          <p style="color:#64748b; font-size:13px;">Your registration is confirmed once payment is completed. Keep this email for your records.</p>
        `,
        footerText: `For queries, please contact the event support team.`,
      }),
      text: `Hi ${name},\n\nThank you for registering for ${event?.eventTitle || 'the event'} under ${category} category.\n${link ? `\nComplete payment: ${link}\n` : '\nOur support team will contact you with further details.\n'}\nYour registration is confirmed once payment is completed.\n`
    });

    res.status(201).json(item);
  } catch (error) {
    console.error('Create registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Resolve a registration link/slug/subdomain to the underlying event (for the user website)
export async function resolveRegistrationLink(req, res) {
  const { slug } = req.params;
  try {
    const event = await resolveEventByRef(slug);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(event);
  } catch (error) {
    console.error('Resolve registration link error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
