import { findBySubdomain } from '../services/eventResolver.js';
import { registrationLink } from '../services/eventLink.js';
import { Conference } from '../models/Conference.js';
import { CourseCohort } from '../models/CourseCohort.js';
import { listCohorts, getCurrentCohort, serializeCohort } from '../services/cohortService.js';

// Public: resolve a subdomain to its full event payload for the event microsite.
export async function getEventBySubdomain(req, res) {
  const { subdomain } = req.params;
  try {
    const normalized = await findBySubdomain(subdomain);
    if (!normalized) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = await Conference.findById(normalized.eventId).lean();
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const courseType = normalized.eventType;
    const cohorts = await listCohorts(courseType, normalized.eventId);

    // If the subdomain resolved to a specific cohort, use it directly;
    // otherwise fall back to the course's current cohort.
    let resolvedCohort = null;
    if (normalized.cohortId) {
      const cohort = await CourseCohort.findById(normalized.cohortId).lean();
      if (cohort) resolvedCohort = serializeCohort(cohort);
    }
    if (!resolvedCohort) {
      resolvedCohort = await getCurrentCohort(courseType, normalized.eventId, event.currentCohortId);
    }

    res.json({
      eventType: normalized.eventType,
      registrationLink: registrationLink({ ...event, subdomain: normalized.subdomain }),
      ...event,
      partners: event.partners || [],
      sponsors: event.sponsors || [],
      exhibitors: event.exhibitors || [],
      mediaPartners: event.mediaPartners || [],
      cohorts,
      currentCohort: resolvedCohort,
      activeCohort: resolvedCohort,
    });
  } catch (error) {
    console.error('Get event by subdomain error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
