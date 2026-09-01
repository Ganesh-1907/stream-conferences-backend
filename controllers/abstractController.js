import { Abstract } from '../models/Abstract.js';
import { Conference } from '../models/Conference.js';
import { Webinar } from '../models/Webinar.js';
import { r2Enabled, uploadToR2 } from '../services/r2.js';
import { sendMail } from '../services/mail.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const REGISTRATION_BASE = process.env.REGISTRATION_BASE || 'http://localhost:5174/register';

function registrationLink(event) {
  return `${REGISTRATION_BASE}?event=${encodeURIComponent(event?.eventSlug || event?.slug || event?.eventId || '')}`;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', 'uploads');

function fileExtension(mimetype, originalname) {
  if (originalname && originalname.includes('.')) {
    const ext = originalname.split('.').pop();
    if (ext && ext.length <= 5 && /^[a-zA-Z0-9]+$/.test(ext)) return `.${ext.toLowerCase()}`;
  }
  const map = {
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
  };
  return map[mimetype] || '.pdf';
}

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

export async function listAbstracts(req, res) {
  try {
    const list = await Abstract.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    console.error('Fetch abstracts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function submitAbstract(req, res) {
  const { firstName, lastName, name, email, phone, institution, country, track, summary, eventId, eventType, eventSlug } = req.body;
  try {
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'Missing required abstract fields' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Abstract PDF file is required' });
    }

    const event = await resolveEvent(eventId, eventType, eventSlug);

    const ext = fileExtension(req.file.mimetype, req.file.originalname);
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    let abstractFile;

    if (r2Enabled) {
      await uploadToR2(key, req.file.buffer, req.file.mimetype);
      abstractFile = `/api/files/${key}`;
    } else {
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      fs.writeFileSync(path.join(uploadDir, key), req.file.buffer);
      abstractFile = `/uploads/${key}`;
    }

    const fullName = name || `${firstName} ${lastName}`.trim();

    const item = await Abstract.create({
      firstName,
      lastName,
      name: fullName,
      email,
      phone,
      institution,
      country,
      abstractFile,
      track,
      summary,
      eventId: event?.eventId || null,
      eventType: event?.eventType || null,
      eventTitle: event?.eventTitle || null,
      eventSlug: event?.eventSlug || null
    });

    await sendMail({
      to: email,
      subject: `Abstract received${event?.eventTitle ? ` — ${event.eventTitle}` : ''}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;">
          <h2 style="color: #0e7490;">Thank you for your submission</h2>
          <p>Hi ${fullName},</p>
          <p>We have received your abstract${event?.eventTitle ? ` for <strong>${event.eventTitle}</strong>` : ''}.</p>
          <p>Your submission is now under review by our Scientific Advisory Board. You will receive a separate decision notification by email within 5 to 7 business days.</p>
          <p style="color: #666; font-size: 13px;">Please keep this email for your records.</p>
        </div>
      `,
      text: `Hi ${fullName},\n\nWe have received your abstract${event?.eventTitle ? ` for ${event.eventTitle}` : ''}.\n\nYour submission is now under review. You will receive a decision notification by email within 5 to 7 business days.\n`
    });

    res.status(201).json(item);
  } catch (error) {
    console.error('Create abstract error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function resolveFullEvent(abstract) {
  if (abstract.eventId) {
    if (abstract.eventType === 'webinar') {
      const w = await Webinar.findById(abstract.eventId).select('title slug eventId').lean();
      if (w) return w;
    } else {
      const c = await Conference.findById(abstract.eventId).select('title slug eventId').lean();
      if (c) return c;
    }
  }
  if (abstract.eventSlug) {
    const c = await Conference.findOne({ slug: abstract.eventSlug }).select('title slug eventId').lean();
    if (c) return c;
    const w = await Webinar.findOne({ slug: abstract.eventSlug }).select('title slug eventId').lean();
    if (w) return w;
  }
  return null;
}

export async function approveAbstract(req, res) {
  const { id } = req.params;
  try {
    const abstract = await Abstract.findById(id);
    if (!abstract) return res.status(404).json({ error: 'Abstract not found' });

    abstract.status = 'approved';
    abstract.rejectionReason = undefined;
    abstract.reviewedAt = new Date();
    await abstract.save();

    const event = await resolveFullEvent(abstract);
    const link = event ? registrationLink(event) : null;
    const name = abstract.name || `${abstract.firstName || ''} ${abstract.lastName || ''}`.trim();
    const eventLabel = abstract.eventTitle || event?.title || 'the event';

    await sendMail({
      to: abstract.email,
      subject: `Your abstract has been approved — ${eventLabel}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;">
          <h2 style="color: #0e7490;">Congratulations, ${name}</h2>
          <p>Your abstract for <strong>${eventLabel}</strong> has been approved by our Scientific Advisory Board.</p>
          ${link
            ? `<p style="margin: 28px 0;"><a href="${link}" style="background: #0e7490; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 6px; font-weight: bold;">Complete your registration</a></p>`
            : `<p>Please complete your registration to confirm your participation.</p>`}
          <p style="color: #666; font-size: 13px;">Use the link above to register for the event.</p>
        </div>
      `,
      text: `Hi ${name},\n\nYour abstract for ${eventLabel} has been approved.${link ? ` Complete your registration here: ${link}` : ' Please complete your registration to confirm your participation.'}\n`
    });

    res.json(abstract);
  } catch (error) {
    console.error('Approve abstract error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function rejectAbstract(req, res) {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    const abstract = await Abstract.findById(id);
    if (!abstract) return res.status(404).json({ error: 'Abstract not found' });

    abstract.status = 'rejected';
    abstract.rejectionReason = reason || undefined;
    abstract.reviewedAt = new Date();
    await abstract.save();

    const name = abstract.name || `${abstract.firstName || ''} ${abstract.lastName || ''}`.trim();
    const eventLabel = abstract.eventTitle || 'the event';

    await sendMail({
      to: abstract.email,
      subject: `Update on your abstract — ${eventLabel}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;">
          <h2 style="color: #0e7490;">Update on your abstract</h2>
          <p>Hi ${name},</p>
          <p>Thank you for submitting your abstract for <strong>${eventLabel}</strong>. After careful review, we were unable to accept this submission at this time.</p>
          ${reason ? `<p><strong>Review note:</strong> ${reason}</p>` : ''}
          <p style="color: #666; font-size: 13px;">We appreciate your interest and hope you will consider submitting to future events.</p>
        </div>
      `,
      text: `Hi ${name},\n\nThank you for submitting your abstract for ${eventLabel}. After careful review, we were unable to accept this submission at this time.${reason ? `\n\nReview note: ${reason}` : ''}\n`
    });

    res.json(abstract);
  } catch (error) {
    console.error('Reject abstract error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
