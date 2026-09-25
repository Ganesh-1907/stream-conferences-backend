import { Conference } from '../models/Conference.js';
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
    return null;
  }

  const ci = new RegExp(`^${escapeRegExp(str)}$`, 'i');
  const conf = await Conference.findOne({
    $or: [{ eventId: ci }, { slug: str }, { subdomain: ci }]
  }).lean();
  if (conf) return normalize(conf, 'conference');

  return null;
}

export async function findBySubdomain(subdomain) {
  if (!subdomain) return null;
  const ci = new RegExp(`^${escapeRegExp(subdomain)}$`, 'i');

  // Cohort subdomains take priority (e.g. "event-2026").
  const cohort = await CourseCohort.findOne({ subdomain: ci }).lean();
  if (cohort) {
    const course = await Conference.findById(cohort.courseId).lean();
    if (course) {
      return normalize(course, cohort.courseType, cohort._id);
    }
  }

  const conf = await Conference.findOne({
    $or: [{ subdomain: ci }, { eventId: ci }, { slug: subdomain }]
  }).lean();
  if (conf) return normalize(conf, 'conference');

  if (OBJECT_ID.test(subdomain)) {
    const confById = await Conference.findById(subdomain).lean();
    if (confById) return normalize(confById, 'conference');
  }

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
