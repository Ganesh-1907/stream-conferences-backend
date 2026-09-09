import { Conference } from '../models/Conference.js';
import { Registration } from '../models/Registration.js';
import { Order } from '../models/Order.js';
import { Abstract } from '../models/Abstract.js';
import { Contact } from '../models/Contact.js';
import { MentorProfile } from '../models/MentorProfile.js';
import { getUserContext } from '../middleware/auth.js';
import { generateSlug, sanitizeSubdomain, generateSubdomain } from '../services/slug.js';
import { registrationLink } from '../services/eventLink.js';
import { ensureInitialCohort, syncCurrentCohortContent } from '../services/cohortService.js';

const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

const normalizePartners = (arr) => (Array.isArray(arr) ? arr.map((p) => ({ title: p.title || p.name || '', order: p.order || 0 })) : []);

function canAccess(item, username) {
  return item.announcedBy === username || item.assignedMentor === username;
}

function mentorListQuery(username) {
  return { $or: [{ announcedBy: username }, { assignedMentor: username }] };
}

async function uniqueSubdomain(base, Model) {
  let candidate = base;
  let suffix = 2;
  while (await Model.findOne({ subdomain: candidate })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function formatConference(doc) {
  const json = doc.toJSON ? doc.toJSON() : doc;
  const effectivePartners = (json.partners && json.partners.length > 0)
    ? json.partners
    : (json.sponsors && json.sponsors.length > 0)
      ? json.sponsors
      : (json.exhibitors && json.exhibitors.length > 0)
        ? json.exhibitors
        : [];
  return {
    ...json,
    partners: effectivePartners,
    sponsors: effectivePartners,
    exhibitors: effectivePartners,
    registrationLink: registrationLink(doc),
  };
}

export async function listConferences(req, res) {
  const { role, username } = getUserContext(req);
  try {
    let query = {};
    if (role === 'mentor' && username) {
      query = mentorListQuery(username);
    }
    const isSummary = req.query.summary === 'true';
    const projection = isSummary
      ? '_id title theme day month eventDate location announcedBy assignedMentor subdomain slug eventId venue'
      : '';
    const list = await Conference.find(query).sort({ eventDate: 1 }).select(projection);
    if (isSummary) {
      const mentorNames = await mentorUsernameToNameMap(list.map(c => c.assignedMentor));
      res.json(list.map(c => {
        const obj = c.toJSON();
        return {
          _id: obj._id, title: obj.title, theme: obj.theme, day: obj.day, month: obj.month,
          eventDate: obj.eventDate, date: obj.date, location: obj.location,
          announcedBy: obj.announcedBy, assignedMentor: obj.assignedMentor,
          mentorName: obj.assignedMentor ? mentorNames.get(obj.assignedMentor) || obj.assignedMentor : null,
          subdomain: obj.subdomain, slug: obj.slug, eventId: obj.eventId, venue: obj.venue,
          registrationLink: registrationLink(c),
        };
      }));
    } else {
      res.json(list.map(formatConference));
    }
  } catch (error) {
    console.error('Fetch conferences error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function mentorUsernameToNameMap(usernames) {
  const unique = [...new Set(usernames.filter(Boolean))];
  if (!unique.length) return new Map();
  const profiles = await MentorProfile.find({ username: { $in: unique } }).select('username fullName');
  return new Map(profiles.map(p => [p.username, p.fullName || p.username]));
}

export async function getConference(req, res) {
  const { id } = req.params;
  try {
    const item = await Conference.findById(id);
    if (!item) {
      return res.status(404).json({ error: 'Conference not found' });
    }
    res.json(formatConference(item));
  } catch (error) {
    console.error('Get conference error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createConference(req, res) {
  const { username } = getUserContext(req);
  const {
    title, description, theme, themeColor, day, month, location, eventDate, startDate, endDate, slug,
    startTime, endTime, brochureUrl, bannerUrl, logoUrl, headerBanners, fees, tracks, organizerContact,
    subdomain, venue, assignedMentor, venueAddress, venueMapUrl,
    itinerary, speakers, program, faqs, sponsors, exhibitors, guidelines, scientificProgramUrl, termsAndConditions, venueDetails,
    organizingCommittee, partners
  } = req.body;
  try {
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const baseSubdomain = sanitizeSubdomain(subdomain || generateSubdomain(title));
    if (!SUBDOMAIN_RE.test(baseSubdomain)) {
      return res.status(400).json({ error: 'Subdomain must contain only lowercase letters, numbers, and hyphens' });
    }
    const resolvedSubdomain = await uniqueSubdomain(baseSubdomain, Conference);

    const start = startDate ? new Date(startDate) : (eventDate ? new Date(eventDate) : null);
    const end = endDate ? new Date(endDate) : (startDate ? start : null);

    const finalPartners = (partners && partners.length)
      ? normalizePartners(partners)
      : ((sponsors && sponsors.length)
        ? normalizePartners(sponsors)
        : normalizePartners(exhibitors));

    const item = await Conference.create({
      title,
      description: description || '',
      theme: theme || '',
      themeColor: themeColor || '',
      day: day || '',
      month: month || '',
      location: location || '',
      venue: venue || '',
      venueAddress: venueAddress || '',
      venueMapUrl: venueMapUrl || '',
      eventDate: start,
      startDate: start,
      endDate: end,
      subdomain: resolvedSubdomain,
      assignedMentor: assignedMentor || null,
      slug: slug || generateSlug(title, 'conf'),
      startTime: startTime || '',
      endTime: endTime || '',
      brochureUrl: brochureUrl || '',
      bannerUrl: bannerUrl || '',
      logoUrl: logoUrl || '',
      headerBanners: Array.isArray(headerBanners) ? headerBanners : [],
      fees: Array.isArray(fees) ? fees : [],
      tracks: Array.isArray(tracks) ? tracks : [],
      organizerContact: organizerContact || {},
      itinerary: Array.isArray(itinerary) ? itinerary : [],
      speakers: Array.isArray(speakers) ? speakers : [],
      program: Array.isArray(program) ? program : [],
      faqs: Array.isArray(faqs) ? faqs : [],
      partners: finalPartners,
      sponsors: finalPartners,
      exhibitors: finalPartners,
      guidelines: guidelines || '',
      scientificProgramUrl: scientificProgramUrl || '',
      termsAndConditions: termsAndConditions || '',
      venueDetails: venueDetails || {},
      organizingCommittee: Array.isArray(organizingCommittee) ? organizingCommittee : [],
      announcedBy: username
    });
    const cohort = await ensureInitialCohort('conference', item);
    if (cohort) item.currentCohortId = cohort._id;
    res.status(201).json(formatConference(item));
  } catch (error) {
    console.error('Create conference error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateConference(req, res) {
  const { role, username } = getUserContext(req);
  const { id } = req.params;
  const {
    title, description, theme, themeColor, day, month, location, eventDate, startDate, endDate, slug,
    startTime, endTime, brochureUrl, bannerUrl, logoUrl, headerBanners, fees, tracks, organizerContact,
    subdomain, venue, assignedMentor, venueAddress, venueMapUrl,
    itinerary, speakers, program, faqs, sponsors, exhibitors, guidelines, scientificProgramUrl, termsAndConditions, venueDetails,
    organizingCommittee, partners
  } = req.body;
  try {
    const item = await Conference.findById(id);
    if (!item) {
      return res.status(404).json({ error: 'Conference not found' });
    }
    if (role === 'mentor' && !canAccess(item, username)) {
      return res.status(403).json({ error: 'Forbidden: Cannot edit another user\'s conference' });
    }

    item.title = title ?? item.title;
    item.description = description ?? item.description;
    item.theme = theme ?? item.theme;
    if (themeColor !== undefined) item.themeColor = themeColor;
    item.day = day ?? item.day;
    item.month = month ?? item.month;
    item.location = location ?? item.location;
    if (venue !== undefined) item.venue = venue;
    if (venueAddress !== undefined) item.venueAddress = venueAddress;
    if (venueMapUrl !== undefined) item.venueMapUrl = venueMapUrl;
    const safeDate = (v) => (v && v !== '' ? new Date(v) : null);
    if (startDate !== undefined) {
      const d = safeDate(startDate);
      item.startDate = d;
      item.eventDate = d || item.eventDate;
    }
    if (eventDate !== undefined) {
      const d = safeDate(eventDate);
      if (d) item.eventDate = d;
    }
    if (endDate !== undefined) item.endDate = safeDate(endDate);
    if (subdomain !== undefined) {
      const cleaned = sanitizeSubdomain(subdomain);
      if (!SUBDOMAIN_RE.test(cleaned)) {
        return res.status(400).json({ error: 'Subdomain must contain only lowercase letters, numbers, and hyphens' });
      }
      if (cleaned !== item.subdomain) {
        item.subdomain = await uniqueSubdomain(cleaned, Conference);
      }
    }
    if (assignedMentor !== undefined) item.assignedMentor = assignedMentor || null;
    if (slug !== undefined && slug !== null && slug !== '') item.slug = slug;
    if (startTime !== undefined) item.startTime = startTime;
    if (endTime !== undefined) item.endTime = endTime;
    if (brochureUrl !== undefined) item.brochureUrl = brochureUrl;
    if (bannerUrl !== undefined) item.bannerUrl = bannerUrl;
    if (logoUrl !== undefined) item.logoUrl = logoUrl;
    if (headerBanners !== undefined) item.headerBanners = Array.isArray(headerBanners) ? headerBanners : [];
    if (fees !== undefined) item.fees = Array.isArray(fees) ? fees : [];
    if (tracks !== undefined) item.tracks = Array.isArray(tracks) ? tracks : [];
    if (organizerContact !== undefined) { item.organizerContact = organizerContact; item.markModified('organizerContact'); }
    if (itinerary !== undefined) item.itinerary = Array.isArray(itinerary) ? itinerary : [];
    if (speakers !== undefined) item.speakers = Array.isArray(speakers) ? speakers : [];
    if (program !== undefined) item.program = Array.isArray(program) ? program : [];
    if (faqs !== undefined) item.faqs = Array.isArray(faqs) ? faqs : [];
    if (partners !== undefined) {
      const normalized = normalizePartners(partners);
      item.partners = normalized;
      item.sponsors = normalized;
      item.exhibitors = normalized;
    }
    if (sponsors !== undefined) {
      const normalized = normalizePartners(sponsors);
      item.sponsors = normalized;
      if (partners === undefined) item.partners = normalized;
      if (exhibitors === undefined) item.exhibitors = normalized;
    }
    if (exhibitors !== undefined) {
      const normalized = normalizePartners(exhibitors);
      item.exhibitors = normalized;
      if (partners === undefined && sponsors === undefined) item.partners = normalized;
    }
    if (guidelines !== undefined) item.guidelines = guidelines || '';
    if (scientificProgramUrl !== undefined) item.scientificProgramUrl = scientificProgramUrl || '';
    if (termsAndConditions !== undefined) item.termsAndConditions = termsAndConditions || '';
    if (venueDetails !== undefined) item.venueDetails = venueDetails || {};
    if (organizingCommittee !== undefined) item.organizingCommittee = Array.isArray(organizingCommittee) ? organizingCommittee : [];

    await item.save();
    await syncCurrentCohortContent('conference', item);
    res.json(formatConference(item));
  } catch (error) {
    console.error('Update conference error:', error.message);
    console.error('Error stack:', error.stack);
    if (error.name === 'ValidationError') {
      console.error('Validation errors:', error.errors);
    }
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

export async function assignConferenceMentor(req, res) {
  const { id } = req.params;
  const { assignedMentor } = req.body;
  try {
    const item = await Conference.findById(id);
    if (!item) {
      return res.status(404).json({ error: 'Conference not found' });
    }
    item.assignedMentor = assignedMentor || null;
    await item.save();
    res.json({ ...item.toJSON(), registrationLink: registrationLink(item) });
  } catch (error) {
    console.error('Assign conference mentor error:', error);
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
    if (role === 'mentor' && !canAccess(item, username)) {
      return res.status(403).json({ error: 'Forbidden: Cannot delete another user\'s conference' });
    }
    await Conference.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete conference error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function conferenceAccessGuard(event, role, username) {
  if (!event) return { error: 'Conference not found', status: 404 };
  if (role === 'mentor' && !canAccess(event, username)) {
    return { error: 'Forbidden: Cannot view another user\'s conference data', status: 403 };
  }
  return null;
}

async function loadParticipants(id, kind = 'conference', cohortId = null) {
  const q = { eventId: id, eventType: kind };
  if (cohortId) q.cohortId = cohortId;
  return Registration.find(q).sort({ createdAt: -1 });
}

async function loadPayments(id, kind = 'conference', cohortId = null) {
  const q = { eventId: id, eventType: kind };
  if (cohortId) q.cohortId = cohortId;
  return Order.find(q).sort({ createdAt: -1 });
}

function paymentStats(payments) {
  const paid = payments.filter(p => p.status === 'paid');
  const revenuePaise = paid.reduce((sum, p) => sum + (p.amount || 0), 0);
  return {
    totalPayments: payments.length,
    paidCount: paid.length,
    pendingCount: payments.filter(p => p.status === 'pending').length,
    failedCount: payments.filter(p => p.status === 'failed').length,
    revenuePaise,
    revenue: (revenuePaise / 100).toFixed(2),
  };
}

// Per-event dashboard stats (counts only)
export async function getConferenceDashboard(req, res) {
  const { role, username } = getUserContext(req);
  const { id } = req.params;
  const { cohortId } = req.query;
  try {
    const event = await Conference.findById(id).select('title eventId assignedMentor announcedBy');
    const guard = conferenceAccessGuard(event, role, username);
    if (guard) return res.status(guard.status).json({ error: guard.error });
    const [participants, payments] = await Promise.all([
      loadParticipants(id, 'conference', cohortId),
      loadPayments(id, 'conference', cohortId),
    ]);
    res.json({
      eventId: id,
      title: event.title,
      stats: { totalParticipants: participants.length, ...paymentStats(payments) },
    });
  } catch (error) {
    console.error('Get conference dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Per-event participants registered for this conference
export async function getConferenceParticipants(req, res) {
  const { role, username } = getUserContext(req);
  const { id } = req.params;
  const { cohortId } = req.query;
  try {
    const event = await Conference.findById(id).select('title eventId assignedMentor announcedBy');
    const guard = conferenceAccessGuard(event, role, username);
    if (guard) return res.status(guard.status).json({ error: guard.error });
    const participants = await loadParticipants(id, 'conference', cohortId);
    res.json({ eventId: id, participants });
  } catch (error) {
    console.error('Get conference participants error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Per-event payments for this conference
export async function getConferencePayments(req, res) {
  const { role, username } = getUserContext(req);
  const { id } = req.params;
  const { cohortId } = req.query;
  try {
    const event = await Conference.findById(id).select('title eventId assignedMentor announcedBy');
    const guard = conferenceAccessGuard(event, role, username);
    if (guard) return res.status(guard.status).json({ error: guard.error });
    const payments = await loadPayments(id, 'conference', cohortId);
    res.json({ eventId: id, stats: paymentStats(payments), payments });
  } catch (error) {
    console.error('Get conference payments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Abstracts submitted against this conference
export async function getConferenceAbstracts(req, res) {
  const { role, username } = getUserContext(req);
  const { id } = req.params;
  const { cohortId } = req.query;
  try {
    const event = await Conference.findById(id);
    if (!event) return res.status(404).json({ error: 'Conference not found' });
    if (role === 'mentor' && !canAccess(event, username)) {
      return res.status(403).json({ error: 'Forbidden: Cannot view another user\'s conference abstracts' });
    }
    const q = { eventId: id, eventType: 'conference' };
    if (cohortId) q.cohortId = cohortId;
    const list = await Abstract.find(q).sort({ createdAt: -1 });
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
  const { cohortId } = req.query;
  try {
    const event = await Conference.findById(id);
    if (!event) return res.status(404).json({ error: 'Conference not found' });
    if (role === 'mentor' && !canAccess(event, username)) {
      return res.status(403).json({ error: 'Forbidden: Cannot view another user\'s conference enquiries' });
    }
    const q = { eventId: id, eventType: 'conference' };
    if (cohortId) q.cohortId = cohortId;
    const list = await Contact.find(q).sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    console.error('Get conference enquiries error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
