import { BrochureRequest } from '../models/BrochureRequest.js';
import { resolveEventByRef } from '../services/eventResolver.js';

export async function listBrochureRequests(req, res) {
  const { eventId, eventType } = req.query;
  try {
    const query = {};
    if (eventId) query.eventId = eventId;
    if (eventType) query.eventType = eventType;
    const list = await BrochureRequest.find(query).sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    console.error('Fetch brochure requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createBrochureRequest(req, res) {
  const { firstName, lastName, email, phone, institution, country, eventId, eventType, eventSlug } = req.body;
  try {
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'Missing required fields (firstName, lastName, email)' });
    }

    let event = null;
    if (eventId) {
      const type = eventType || 'conference';
      event = await resolveEventByRef(eventId);
      if (event && type && event.eventType !== type) event = null;
    } else if (eventSlug) {
      event = await resolveEventByRef(eventSlug);
    }

    const item = await BrochureRequest.create({
      firstName,
      lastName,
      email,
      phone,
      institution,
      country,
      eventId: event?.eventId || null,
      eventType: event?.eventType || null,
      eventTitle: event?.eventTitle || null,
      eventSlug: event?.eventSlug || null
    });

    res.status(201).json(item);
  } catch (error) {
    console.error('Create brochure request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
