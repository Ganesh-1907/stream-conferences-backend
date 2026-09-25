import { CourseCohort } from '../models/CourseCohort.js';
import { Conference } from '../models/Conference.js';

const COURSE_MODEL = {
  conference: Conference,
};

// Website content fields that live on a cohort (everything except the course shell).
const CONTENT_FIELDS = [
  'description', 'theme', 'day', 'month', 'location', 'venue', 'venueAddress', 'venueMapUrl',
  'eventDate', 'startDate', 'endDate', 'startTime', 'endTime', 'speaker',
  'brochureUrl', 'bannerUrl', 'logoUrl', 'headerBanners', 'fees', 'tracks',
  'organizerContact', 'itinerary', 'speakers', 'program', 'faqs', 'sponsors', 'exhibitors',
  'partners', 'mediaPartners', 'guidelines', 'scientificProgramUrl', 'termsAndConditions', 'organizingCommittee', 'venueDetails',
];

export function extractContent(doc) {
  if (!doc) return {};
  const json = doc.toJSON ? doc.toJSON() : doc;
  const content = {};
  for (const field of CONTENT_FIELDS) {
    if (json[field] !== undefined) content[field] = json[field];
  }
  return content;
}

export function cohortLabel(cohort) {
  if (!cohort) return '';
  return cohort.title || `${cohort.year} Batch ${cohort.batchNo}`;
}

export function serializeCohort(doc) {
  if (!doc) return null;
  const json = doc.toJSON ? doc.toJSON() : doc;
  return {
    _id: json._id.toString(),
    courseType: json.courseType,
    courseId: json.courseId ? json.courseId.toString() : json.courseId,
    cohortId: json.cohortId || '',
    year: json.year,
    batchNo: json.batchNo,
    title: json.title || '',
    startDate: json.startDate ? new Date(json.startDate).toISOString() : null,
    endDate: json.endDate ? new Date(json.endDate).toISOString() : null,
    status: json.status || 'upcoming',
    isCurrent: Boolean(json.isCurrent),
    label: cohortLabel(json),
    subdomain: json.subdomain || null,
    assignedMentor: json.assignedMentor || null,
    content: json.content || {},
    createdAt: json.createdAt || null,
    updatedAt: json.updatedAt || null,
  };
}

export async function listCohorts(courseType, courseId) {
  const cohorts = await CourseCohort.find({ courseType, courseId })
    .sort({ year: -1, batchNo: -1 })
    .lean();
  return cohorts.map(serializeCohort);
}

// Build a cohort's human-friendly ID from its course eventId + batch number.
// e.g. course eventId "SCC20262" -> cohort "SCC20262-1", "SCC20262-2", ...
export async function buildCohortId(courseType, courseId, batchNo) {
  const Model = COURSE_MODEL[courseType];
  if (!Model) return null;
  const course = await Model.findById(courseId).select('eventId').lean();
  const base = course && course.eventId ? String(course.eventId) : null;
  if (!base) return null;
  return `${base}-${batchNo}`;
}

export async function getCurrentCohort(courseType, courseId, currentCohortId) {
  if (currentCohortId) {
    const cohort = await CourseCohort.findById(currentCohortId).lean();
    if (cohort && cohort.courseType === courseType && String(cohort.courseId) === String(courseId)) {
      return serializeCohort(cohort);
    }
  }
  const fallback = await CourseCohort.findOne({ courseType, courseId, isCurrent: true }).lean();
  return fallback ? serializeCohort(fallback) : null;
}

export async function setCurrentCohort(courseType, courseId, cohortId) {
  const cohort = await CourseCohort.findById(cohortId);
  if (!cohort) throw new Error('Cohort not found');

  if (cohort.isCurrent) {
    // Toggle OFF: unset this cohort as current.
    await CourseCohort.findByIdAndUpdate(cohortId, { isCurrent: false });
    const Model = COURSE_MODEL[courseType];
    if (Model) {
      await Model.findByIdAndUpdate(courseId, { currentCohortId: null });
    }
  } else {
    // Toggle ON: make this cohort current, unset others.
    await CourseCohort.updateMany(
      { courseType, courseId, _id: { $ne: cohortId } },
      { isCurrent: false }
    );
    await CourseCohort.findByIdAndUpdate(cohortId, { isCurrent: true });

    const Model = COURSE_MODEL[courseType];
    if (Model) {
      await Model.findByIdAndUpdate(courseId, { currentCohortId: cohortId });
    }
  }
}

export async function promoteLatestCohort(courseType, courseId) {
  const latest = await CourseCohort.findOne({ courseType, courseId })
    .sort({ year: -1, batchNo: -1 });
  const Model = COURSE_MODEL[courseType];

  if (!latest) {
    if (Model) await Model.findByIdAndUpdate(courseId, { currentCohortId: null });
    return null;
  }

  await setCurrentCohort(courseType, courseId, latest._id);
  return serializeCohort(latest);
}

function deriveStatus(startDate, endDate) {
  const now = Date.now();
  const start = startDate ? new Date(startDate).getTime() : null;
  const end = endDate ? new Date(endDate).getTime() : null;
  if (end && now > end) return 'completed';
  if (start && now >= start) return 'active';
  return 'upcoming';
}

// Create the first cohort for a course that has none (backward compatibility).
export async function ensureInitialCohort(courseType, course) {
  if (!course || !course._id) return null;

  const existing = await CourseCohort.findOne({ courseType, courseId: course._id });
  if (existing) return existing;

  const startDate = course.startDate || course.eventDate || null;
  const endDate = course.endDate || startDate;
  const year = (startDate ? new Date(startDate) : new Date()).getFullYear();

  const cohortId = await buildCohortId(courseType, course._id, 1);
  const cohort = await CourseCohort.create({
    courseType,
    courseId: course._id,
    cohortId,
    year,
    batchNo: 1,
    startDate: startDate || null,
    endDate: endDate || null,
    status: deriveStatus(startDate, endDate),
    isCurrent: true,
    assignedMentor: course.assignedMentor || null,
    content: {},
  });

  const Model = COURSE_MODEL[courseType];
  if (Model) {
    await Model.findByIdAndUpdate(course._id, { currentCohortId: cohort._id });
  }

  return cohort;
}

// DEPRECATED: syncCurrentCohortContent and snapshotContent removed.
// Cohorts are now fully independent - parent edits do NOT cascade to children.
// Each cohort maintains its own content that is only modified via cohort-specific endpoints.
