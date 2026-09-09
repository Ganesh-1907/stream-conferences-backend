import { Conference } from '../models/Conference.js';
import { Webinar } from '../models/Webinar.js';
import { CourseCohort } from '../models/CourseCohort.js';

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Resolve a reference (Mongo _id, eventId, slug, or subdomain) to a normalized event.
export async function resolveEventByRef(ref) {
  if (!ref) return null;
  const str = String(ref);

  // Direct Mongo ObjectId lookup.
  if (OBJECT_ID.test(str)) {
    const conf = await Conference.findById(str).lean();
    if (conf) return normalize(conf, 'conference');
    const web = await Webinar.findById(str).lean();
    if (web) return normalize(web, 'webinar');
    return null;
  }

  const ci = new RegExp(`^${escapeRegExp(str)}$`, 'i');
  const conf = await Conference.findOne({
    $or: [{ eventId: ci }, { slug: str }, { subdomain: ci }]
  }).lean();
  if (conf) return normalize(conf, 'conference');

  const web = await Webinar.findOne({
    $or: [{ eventId: ci }, { slug: str }, { subdomain: ci }]
  }).lean();
  if (web) return normalize(web, 'webinar');

  return null;
}

export async function findBySubdomain(subdomain) {
  if (!subdomain) return null;
  const ci = new RegExp(`^${escapeRegExp(subdomain)}$`, 'i');

  // Cohort subdomains take priority (e.g. "event-2026").
  const cohort = await CourseCohort.findOne({ subdomain: ci }).lean();
  if (cohort) {
    const Model = cohort.courseType === 'webinar' ? Webinar : Conference;
    const course = await Model.findById(cohort.courseId).lean();
    if (course) {
      return normalize(course, cohort.courseType, cohort._id);
    }
  }

  const conf = await Conference.findOne({ subdomain: ci }).lean();
  if (conf) return normalize(conf, 'conference');
  const web = await Webinar.findOne({ subdomain: ci }).lean();
  if (web) return normalize(web, 'webinar');
  return null;
}

export async function resolveFullEvent(ref) {
  const normalized = await resolveEventByRef(ref);
  if (!normalized) return null;
  return findBySubdomain(normalized.subdomain) || resolveEventByRef(normalized.eventId);
}

function normalize(doc, eventType, cohortId = null) {
  if (!doc) return null;
  return {
    eventId: doc._id.toString(),
    eventType,
    eventTitle: doc.title,
    eventSlug: doc.slug,
    eventCustomId: doc.eventId,
    subdomain: doc.subdomain || null,
    startDate: doc.startDate || doc.eventDate || null,
    endDate: doc.endDate || null,
    cohortId: cohortId ? cohortId.toString() : null,
  };
}
