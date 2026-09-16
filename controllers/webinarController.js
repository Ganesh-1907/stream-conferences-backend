import { Webinar } from '../models/Webinar.js';
import { CourseCohort } from '../models/CourseCohort.js';
import { Registration } from '../models/Registration.js';
import { Order } from '../models/Order.js';
import { Abstract } from '../models/Abstract.js';
import { Contact } from '../models/Contact.js';
import { MentorProfile } from '../models/MentorProfile.js';
import { getUserContext } from '../middleware/auth.js';
import { generateSlug, sanitizeSubdomain, generateSubdomain } from '../services/slug.js';
import { registrationLink } from '../services/eventLink.js';
import { ensureInitialCohort } from '../services/cohortService.js';

const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

const normalizePartners = (arr) => (Array.isArray(arr) ? arr.map((p) => ({ title: p.title || p.name || '', name: p.name || p.title || '', logo: p.logo || '', order: p.order || 0 })) : []);

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

function formatWebinar(doc) {
  const json = doc.toJSON ? doc.toJSON() : doc;
  return {
    ...json,
    sponsors: json.sponsors || [],
    exhibitors: json.exhibitors || [],
    partners: json.partners || [],
    mediaPartners: json.mediaPartners || [],
    registrationLink: registrationLink(doc),
  };
}

export async function listWebinars(req, res) {
  const { role, username } = getUserContext(req);
  try {
    const isSummary = req.query.summary === 'true';

    if (role === 'mentor' && username) {
      const cohortAssignments = await CourseCohort.find({ courseType: 'webinar', assignedMentor: username }).lean();
      const parentAssignments = await Webinar.find({ assignedMentor: username }).select('_id').lean();
      const parentIdsFromCohorts = cohortAssignments.map(c => c.courseId.toString());
      const parentIdsFromParent = parentAssignments.map(p => p._id.toString());
      const allParentIds = [...new Set([...parentIdsFromCohorts, ...parentIdsFromParent])];

      if (!allParentIds.length) return res.json([]);

      const parents = await Webinar.find({ _id: { $in: allParentIds } }).lean();
      const cohortByParent = new Map();
      for (const c of cohortAssignments) {
        const pid = c.courseId.toString();
        if (!cohortByParent.has(pid)) cohortByParent.set(pid, []);
        cohortByParent.get(pid).push(c);
      }

      const mentorNames = await mentorUsernameToNameMapWebinar([username]);
      const mentorName = mentorNames.get(username) || username;
      const result = [];

      for (const parent of parents) {
        const pid = parent._id.toString();
        const cohorts = cohortByParent.get(pid);
        const isDirectlyAssigned = parent.assignedMentor === username;
        if (cohorts && cohorts.length) {
          for (const cohort of cohorts) {
            const content = cohort.content || {};
            if (isSummary) {
              result.push({
                _id: parent._id,
                eventId: cohort.cohortId || parent.eventId,
                title: content.title || cohort.title || parent.title,
                theme: content.theme || parent.theme,
                day: content.day || parent.day,
                month: content.month || parent.month,
                eventDate: content.startDate || parent.eventDate,
                date: cohort.status,
                location: content.location || parent.location,
                announcedBy: parent.announcedBy,
                assignedMentor: username,
                mentorName,
                subdomain: parent.subdomain,
                slug: parent.slug,
                venue: content.venue || parent.venue,
                cohortId: cohort._id.toString(),
                cohortCode: cohort.cohortId,
                isCohort: true,
                registrationLink: registrationLink({ ...parent, currentCohortId: cohort._id }),
              });
            } else {
              result.push(formatWebinar({ ...parent, currentCohortId: cohort._id }));
            }
          }
          if (isDirectlyAssigned) {
            if (isSummary) {
              result.push({
                _id: parent._id,
                eventId: parent.eventId,
                title: parent.title,
                theme: parent.theme,
                day: parent.day,
                month: parent.month,
                eventDate: parent.eventDate,
                date: parent.date,
                location: parent.location,
                announcedBy: parent.announcedBy,
                assignedMentor: parent.assignedMentor,
                mentorName: parent.assignedMentor ? mentorName : null,
                subdomain: parent.subdomain,
                slug: parent.slug,
                venue: parent.venue,
                registrationLink: registrationLink(parent),
              });
            } else {
              result.push(formatWebinar(parent));
            }
          }
        } else {
          if (isSummary) {
            result.push({
              _id: parent._id,
              eventId: parent.eventId,
              title: parent.title,
              theme: parent.theme,
              day: parent.day,
              month: parent.month,
              eventDate: parent.eventDate,
              date: parent.date,
              location: parent.location,
              announcedBy: parent.announcedBy,
              assignedMentor: parent.assignedMentor,
              mentorName: parent.assignedMentor ? mentorName : null,
              subdomain: parent.subdomain,
              slug: parent.slug,
              venue: parent.venue,
              registrationLink: registrationLink(parent),
            });
          } else {
            result.push(formatWebinar(parent));
          }
        }
      }

      res.json(result);
      return;
    }

    const query = {};
    const projection = isSummary
      ? '_id title theme day month eventDate location announcedBy assignedMentor subdomain slug eventId venue'
      : '';
    const list = await Webinar.find(query).sort({ eventDate: 1 }).select(projection);
    if (isSummary) {
      const unique = [...new Set(list.map(w => w.assignedMentor).filter(Boolean))];
      const profiles = unique.length ? await MentorProfile.find({ username: { $in: unique } }).select('username fullName') : [];
      const mentorNames = new Map(profiles.map(p => [p.username, p.fullName || p.username]));
      res.json(list.map(w => {
        const obj = w.toJSON();
        return {
          _id: obj._id, title: obj.title, theme: obj.theme, day: obj.day, month: obj.month,
          eventDate: obj.eventDate, date: obj.date, location: obj.location,
          announcedBy: obj.announcedBy, assignedMentor: obj.assignedMentor,
          mentorName: obj.assignedMentor ? mentorNames.get(obj.assignedMentor) || obj.assignedMentor : null,
          subdomain: obj.subdomain, slug: obj.slug, eventId: obj.eventId, venue: obj.venue,
          registrationLink: registrationLink(w),
        };
      }));
    } else {
      res.json(list.map(formatWebinar));
    }
  } catch (error) {
    console.error('Fetch webinars error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function mentorUsernameToNameMapWebinar(usernames) {
  const unique = [...new Set(usernames.filter(Boolean))];
  if (!unique.length) return new Map();
  const profiles = await MentorProfile.find({ username: { $in: unique } }).select('username fullName');
  return new Map(profiles.map(p => [p.username, p.fullName || p.username]));
}

export async function getWebinar(req, res) {
  const { id } = req.params;
  try {
    const item = await Webinar.findById(id);
    if (!item) {
      return res.status(404).json({ error: 'Webinar not found' });
    }
    res.json(formatWebinar(item));
  } catch (error) {
    console.error('Get webinar error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createWebinar(req, res) {
  const { username } = getUserContext(req);
  const {
    title, description, theme, themeColor, day, month, location, eventDate, startDate, endDate, slug,
    speaker, startTime, endTime, brochureUrl, bannerUrl, logoUrl, headerBanners, fees, tracks, organizerContact,
    subdomain, venue, assignedMentor, venueAddress, venueMapUrl,
    itinerary, speakers, program, faqs, sponsors, exhibitors, guidelines, scientificProgramUrl, termsAndConditions, venueDetails,
    organizingCommittee, partners, mediaPartners
  } = req.body;
  try {
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const baseSubdomain = sanitizeSubdomain(subdomain || generateSubdomain(title));
    if (!SUBDOMAIN_RE.test(baseSubdomain)) {
      return res.status(400).json({ error: 'Subdomain must contain only lowercase letters, numbers, and hyphens' });
    }
    const resolvedSubdomain = await uniqueSubdomain(baseSubdomain, Webinar);

    const start = startDate ? new Date(startDate) : (eventDate ? new Date(eventDate) : null);
    const end = endDate ? new Date(endDate) : (startDate ? start : null);

    const finalPartners = (partners && partners.length)
      ? normalizePartners(partners)
      : ((sponsors && sponsors.length)
        ? normalizePartners(sponsors)
        : normalizePartners(exhibitors));

    const item = await Webinar.create({
      title,
      description,
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
      speaker,
      slug: slug || generateSlug(title, 'web'),
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
      sponsors: sponsors && sponsors.length ? normalizePartners(sponsors) : finalPartners,
      exhibitors: exhibitors && exhibitors.length ? normalizePartners(exhibitors) : finalPartners,
      mediaPartners: Array.isArray(mediaPartners) ? normalizePartners(mediaPartners) : [],
      guidelines: guidelines || '',
      scientificProgramUrl: scientificProgramUrl || '',
      termsAndConditions: termsAndConditions || '',
      organizingCommittee: Array.isArray(organizingCommittee) ? organizingCommittee : [],
      venueDetails: venueDetails || {},
      announcedBy: username
    });
    const cohort = await ensureInitialCohort('webinar', item);
    if (cohort) item.currentCohortId = cohort._id;
    res.status(201).json(formatWebinar(item));
  } catch (error) {
    console.error('Create webinar error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateWebinar(req, res) {
  const { role, username } = getUserContext(req);
  const { id } = req.params;
  const {
    title, description, theme, themeColor, day, month, location, eventDate, startDate, endDate, slug,
    speaker, startTime, endTime, brochureUrl, bannerUrl, logoUrl, headerBanners, fees, tracks, organizerContact,
    subdomain, venue, assignedMentor, venueAddress, venueMapUrl,
    itinerary, speakers, program, faqs, sponsors, exhibitors, guidelines, scientificProgramUrl, termsAndConditions, venueDetails,
    organizingCommittee, partners, mediaPartners
  } = req.body;
  try {
    const item = await Webinar.findById(id);
    if (!item) {
      return res.status(404).json({ error: 'Webinar not found' });
    }
    if (role === 'mentor' && !canAccess(item, username)) {
      return res.status(403).json({ error: 'Forbidden: Cannot edit another user\'s webinar' });
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
        item.subdomain = await uniqueSubdomain(cleaned, Webinar);
      }
    }
    if (assignedMentor !== undefined) item.assignedMentor = assignedMentor || null;
    if (speaker !== undefined) item.speaker = speaker;
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
      item.partners = normalizePartners(partners);
    }
    if (sponsors !== undefined) {
      item.sponsors = normalizePartners(sponsors);
    }
    if (exhibitors !== undefined) {
      item.exhibitors = normalizePartners(exhibitors);
    }
    if (mediaPartners !== undefined) {
      item.mediaPartners = Array.isArray(mediaPartners) ? normalizePartners(mediaPartners) : [];
    }
    if (guidelines !== undefined) item.guidelines = guidelines || '';
    if (scientificProgramUrl !== undefined) item.scientificProgramUrl = scientificProgramUrl || '';
    if (termsAndConditions !== undefined) item.termsAndConditions = termsAndConditions || '';
    if (organizingCommittee !== undefined) item.organizingCommittee = Array.isArray(organizingCommittee) ? organizingCommittee : [];
    if (venueDetails !== undefined) item.venueDetails = venueDetails || {};

    await item.save();
    res.json(formatWebinar(item));
  } catch (error) {
    console.error('Update webinar error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function assignWebinarMentor(req, res) {
  const { id } = req.params;
  const { assignedMentor } = req.body;
  try {
    const item = await Webinar.findById(id);
    if (!item) {
      return res.status(404).json({ error: 'Webinar not found' });
    }
    item.assignedMentor = assignedMentor || null;
    await item.save();
    res.json({ ...item.toJSON(), registrationLink: registrationLink(item) });
  } catch (error) {
    console.error('Assign webinar mentor error:', error);
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
    if (role === 'mentor' && !canAccess(item, username)) {
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
function webinarAccessGuard(event, role, username) {
  if (!event) return { error: 'Webinar not found', status: 404 };
  if (role === 'mentor' && !canAccess(event, username)) {
    return { error: 'Forbidden: Cannot view another user\'s webinar data', status: 403 };
  }
  return null;
}

// Per-event dashboard stats (counts only)
export async function getWebinarDashboard(req, res) {
  const { role, username } = getUserContext(req);
  const { id } = req.params;
  const { cohortId } = req.query;
  try {
    const event = await Webinar.findById(id).select('title eventId assignedMentor announcedBy speaker');
    const guard = webinarAccessGuard(event, role, username);
    if (guard) return res.status(guard.status).json({ error: guard.error });
    const rq = { eventId: id, eventType: 'webinar' };
    const oq = { eventId: id, eventType: 'webinar' };
    if (cohortId) { rq.cohortId = cohortId; oq.cohortId = cohortId; }
    const [participants, payments] = await Promise.all([
      Registration.find(rq).sort({ createdAt: -1 }),
      Order.find(oq).sort({ createdAt: -1 }),
    ]);
    const paid = payments.filter(p => p.status === 'paid');
    const revenuePaise = paid.reduce((sum, p) => sum + (p.amount || 0), 0);
    res.json({
      eventId: id,
      title: event.title,
      stats: {
        totalParticipants: participants.length,
        totalPayments: payments.length,
        paidCount: paid.length,
        pendingCount: payments.filter(p => p.status === 'pending').length,
        failedCount: payments.filter(p => p.status === 'failed').length,
        revenuePaise,
        revenue: (revenuePaise / 100).toFixed(2),
      },
    });
  } catch (error) {
    console.error('Get webinar dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getWebinarParticipants(req, res) {
  const { role, username } = getUserContext(req);
  const { id } = req.params;
  const { cohortId } = req.query;
  try {
    const event = await Webinar.findById(id).select('title eventId assignedMentor announcedBy speaker');
    const guard = webinarAccessGuard(event, role, username);
    if (guard) return res.status(guard.status).json({ error: guard.error });
    const q = { eventId: id, eventType: 'webinar' };
    if (cohortId) q.cohortId = cohortId;
    const participants = await Registration.find(q).sort({ createdAt: -1 });
    res.json({ eventId: id, participants });
  } catch (error) {
    console.error('Get webinar participants error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getWebinarPayments(req, res) {
  const { role, username } = getUserContext(req);
  const { id } = req.params;
  const { cohortId } = req.query;
  try {
    const event = await Webinar.findById(id).select('title eventId assignedMentor announcedBy speaker');
    const guard = webinarAccessGuard(event, role, username);
    if (guard) return res.status(guard.status).json({ error: guard.error });
    const q = { eventId: id, eventType: 'webinar' };
    if (cohortId) q.cohortId = cohortId;
    const payments = await Order.find(q).sort({ createdAt: -1 });
    const paid = payments.filter(p => p.status === 'paid');
    const revenuePaise = paid.reduce((sum, p) => sum + (p.amount || 0), 0);
    res.json({
      eventId: id,
      stats: { totalPayments: payments.length, paidCount: paid.length, pendingCount: payments.filter(p => p.status === 'pending').length, failedCount: payments.filter(p => p.status === 'failed').length, revenuePaise, revenue: (revenuePaise / 100).toFixed(2) },
      payments,
    });
  } catch (error) {
    console.error('Get webinar payments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Abstracts submitted against this webinar
export async function getWebinarAbstracts(req, res) {
  const { role, username } = getUserContext(req);
  const { id } = req.params;
  const { cohortId } = req.query;
  try {
    const event = await Webinar.findById(id);
    if (!event) return res.status(404).json({ error: 'Webinar not found' });
    if (role === 'mentor' && !canAccess(event, username)) {
      return res.status(403).json({ error: 'Forbidden: Cannot view another user\'s webinar abstracts' });
    }
    const q = { eventId: id, eventType: 'webinar' };
    if (cohortId) q.cohortId = cohortId;
    const list = await Abstract.find(q).sort({ createdAt: -1 });
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
  const { cohortId } = req.query;
  try {
    const event = await Webinar.findById(id);
    if (!event) return res.status(404).json({ error: 'Webinar not found' });
    if (role === 'mentor' && !canAccess(event, username)) {
      return res.status(403).json({ error: 'Forbidden: Cannot view another user\'s webinar enquiries' });
    }
    const q = { eventId: id, eventType: 'webinar' };
    if (cohortId) q.cohortId = cohortId;
    const list = await Contact.find(q).sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    console.error('Get webinar enquiries error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
