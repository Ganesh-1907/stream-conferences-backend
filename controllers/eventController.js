import { findBySubdomain } from '../services/eventResolver.js';
import { registrationLink } from '../services/eventLink.js';
import { Conference } from '../models/Conference.js';
import { Webinar } from '../models/Webinar.js';

// Public: resolve a subdomain to its full event payload for the event microsite.
export async function getEventBySubdomain(req, res) {
  const { subdomain } = req.params;
  try {
    const normalized = await findBySubdomain(subdomain);
    if (!normalized) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const Model = normalized.eventType === 'webinar' ? Webinar : Conference;
    const event = await Model.findById(normalized.eventId).lean();
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const effectivePartners = (event.partners && event.partners.length > 0)
      ? event.partners
      : (event.sponsors && event.sponsors.length > 0)
        ? event.sponsors
        : (event.exhibitors && event.exhibitors.length > 0)
          ? event.exhibitors
          : [];

    res.json({
      eventType: normalized.eventType,
      registrationLink: registrationLink({ ...event, subdomain: normalized.subdomain }),
      ...event,
      partners: effectivePartners,
      sponsors: effectivePartners,
      exhibitors: effectivePartners,
    });
  } catch (error) {
    console.error('Get event by subdomain error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
