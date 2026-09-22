import { BrochureRequest } from '../models/BrochureRequest.js';
import { MainBrochure } from '../models/MainBrochure.js';
import { resolveEventByRef } from '../services/eventResolver.js';

export async function listBrochureRequests(req, res) {
  const { eventId, eventType, cohortId } = req.query;
  try {
    const query = {};
    if (eventId) query.eventId = eventId;
    if (eventType) query.eventType = eventType;
    if (cohortId) query.cohortId = cohortId;
    const list = await BrochureRequest.find(query).sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    console.error('Fetch brochure requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createBrochureRequest(req, res) {
  const { title, fullName, firstName, lastName, name, email, phone, institution, designation, address, country, eventId, eventType, eventSlug, cohortId } = req.body;
  try {
    const finalFullName = fullName || name || `${firstName || ''} ${lastName || ''}`.trim();
    if (!finalFullName || !email) {
      return res.status(400).json({ error: 'Missing required fields (fullName, email)' });
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
      title,
      fullName: finalFullName,
      firstName: firstName || title,
      lastName: lastName || finalFullName,
      email,
      phone,
      institution,
      designation,
      address,
      country,
      eventId: event?.eventId || null,
      eventType: event?.eventType || null,
      eventTitle: event?.eventTitle || null,
      eventSlug: event?.eventSlug || null,
      cohortId: cohortId || null
    });

    res.status(201).json(item);
  } catch (error) {
    console.error('Create brochure request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getMainBrochure(req, res) {
  try {
    const item = await MainBrochure.findOne().sort({ updatedAt: -1 });
    res.json(item || null);
  } catch (error) {
    console.error('Fetch main brochure error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function saveMainBrochure(req, res) {
  const { fileUrl, fileName, title } = req.body;
  try {
    if (!fileUrl) {
      return res.status(400).json({ error: 'fileUrl is required' });
    }
    await MainBrochure.deleteMany({});
    const item = await MainBrochure.create({
      title: title || 'Official Conference Brochure',
      fileUrl,
      fileName: fileName || 'conference_brochure.pdf'
    });
    res.status(201).json(item);
  } catch (error) {
    console.error('Save main brochure error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteMainBrochure(req, res) {
  try {
    await MainBrochure.deleteMany({});
    res.json({ message: 'Main brochure deleted successfully' });
  } catch (error) {
    console.error('Delete main brochure error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
