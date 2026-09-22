import { Abstract } from '../models/Abstract.js';
import { Conference } from '../models/Conference.js';
import { Webinar } from '../models/Webinar.js';
import { r2Enabled, uploadToR2 } from '../services/r2.js';
import { sendMail } from '../services/mail.js';
import { resolveEventByRef } from '../services/eventResolver.js';
import { registrationLink } from '../services/eventLink.js';
import { emailTemplate } from '../services/emailTemplates.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

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

/** Fetch the full event document (with logoUrl, fees, etc.) for email branding. */
async function fetchFullEvent(eventId, eventType) {
  if (!eventId) return null;
  const Model = eventType === 'webinar' ? Webinar : Conference;
  return Model.findById(eventId).lean();
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
  const { title, fullName, firstName, lastName, name, email, phone, institution, address, country, track, summary, eventId, eventType, eventSlug, cohortId } = req.body;
  try {
    const finalFullName = fullName || name || `${firstName || ''} ${lastName || ''}`.trim();
    if (!finalFullName || !email) {
      return res.status(400).json({ error: 'Missing required abstract fields' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Abstract PDF file is required' });
    }

    const event = await resolveEvent(eventId, eventType, eventSlug);
    const fullEvent = await fetchFullEvent(event?.eventId, event?.eventType);

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

    const displayName = title ? `${title} ${finalFullName}`.trim() : finalFullName;

    const item = await Abstract.create({
      title,
      fullName: finalFullName,
      firstName: firstName || title,
      lastName: lastName || finalFullName,
      name: displayName,
      email,
      phone,
      institution,
      address,
      country,
      abstractFile,
      track,
      summary,
      eventId: event?.eventId || null,
      eventType: event?.eventType || null,
      eventTitle: event?.eventTitle || null,
      eventSlug: event?.eventSlug || null,
      cohortId: cohortId || null
    });

    const link = event ? registrationLink(event) : null;

    await sendMail({
      to: email,
      subject: `Abstract received — ${event?.eventTitle || 'Stream Conferences'}`,
      html: emailTemplate({
        heading: 'Thank you for your submission',
        event: fullEvent,
        preheader: `Your abstract for ${event?.eventTitle || 'the event'} has been received.`,
        body: `
          <p>Hi ${fullName},</p>
          <p>We have received your abstract for <strong>${event?.eventTitle || 'the event'}</strong>.</p>
          <p>Your submission is now under review by our Scientific Advisory Board. You will receive a separate decision notification by email within 5 to 7 business days.</p>
          ${link ? `<p style="margin:24px 0;"><a href="${link}" style="display:inline-block; background:#0e7490; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:6px; font-weight:bold;">Complete Your Registration</a></p>` : ''}
          <p style="color:#64748b; font-size:13px;">Please keep this email for your records.</p>
        `,
        footerText: `If you have questions about your submission, contact us.`,
      }),
      text: `Hi ${fullName},\n\nWe have received your abstract for ${event?.eventTitle || 'the event'}.\n\nYour submission is under review. You will receive a decision within 5-7 business days.\n${link ? `\nComplete your registration: ${link}\n` : ''}`
    });

    res.status(201).json(item);
  } catch (error) {
    console.error('Create abstract error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function resolveFullEvent(abstract) {
  const ref = abstract.eventId || abstract.eventSlug;
  if (!ref) return null;
  const normalized = await resolveEventByRef(ref);
  if (!normalized) return null;
  const Model = normalized.eventType === 'webinar' ? Webinar : Conference;
  return Model.findById(normalized.eventId).lean();
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
    const link = event ? registrationLink({ eventId: abstract.eventId, eventSlug: abstract.eventSlug, subdomain: event.subdomain }) : null;
    const name = abstract.name || `${abstract.firstName || ''} ${abstract.lastName || ''}`.trim();
    const eventLabel = abstract.eventTitle || event?.title || 'the event';

    await sendMail({
      to: abstract.email,
      subject: `Your abstract has been approved — ${eventLabel}`,
      html: emailTemplate({
        heading: `Congratulations, ${name}`,
        event,
        preheader: `Your abstract for ${eventLabel} has been approved.`,
        body: `
          <p>Your abstract for <strong>${eventLabel}</strong> has been approved by our Scientific Advisory Board.</p>
          ${link
            ? `<p style="margin:28px 0;"><a href="${link}" style="display:inline-block; background:#0e7490; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:6px; font-weight:bold;">Complete Your Registration</a></p>`
            : `<p>Please complete your registration to confirm your participation.</p>`}
          <p style="color:#64748b; font-size:13px;">Use the link above to register for the event.</p>
        `,
        footerText: `We look forward to your participation.`,
      }),
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

    const event = await resolveFullEvent(abstract);
    const name = abstract.name || `${abstract.firstName || ''} ${abstract.lastName || ''}`.trim();
    const eventLabel = abstract.eventTitle || event?.title || 'the event';

    await sendMail({
      to: abstract.email,
      subject: `Update on your abstract — ${eventLabel}`,
      html: emailTemplate({
        heading: 'Update on your abstract',
        event,
        preheader: `Your abstract for ${eventLabel} was not accepted.`,
        body: `
          <p>Hi ${name},</p>
          <p>Thank you for submitting your abstract for <strong>${eventLabel}</strong>. After careful review, we were unable to accept this submission at this time.</p>
          ${reason ? `<p><strong>Review note:</strong> ${reason}</p>` : ''}
          <p style="color:#64748b; font-size:13px;">We appreciate your interest and hope you will consider submitting to future events.</p>
        `,
        footerText: `Thank you for your interest in ${eventLabel}.`,
      }),
      text: `Hi ${name},\n\nThank you for submitting your abstract for ${eventLabel}. After careful review, we were unable to accept this submission at this time.${reason ? `\n\nReview note: ${reason}` : ''}\n`
    });

    res.json(abstract);
  } catch (error) {
    console.error('Reject abstract error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
