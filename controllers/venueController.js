import { Venue } from '../models/Venue.js';
import { getUserContext } from '../middleware/auth.js';

export async function listVenues(req, res) {
  try {
    const list = await Venue.find().sort({ name: 1 });
    res.json(list);
  } catch (error) {
    console.error('Fetch venues error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createVenue(req, res) {
  const { username } = getUserContext(req);
  const { name, address, locationUrl } = req.body;
  try {
    if (!name) {
      return res.status(400).json({ error: 'Venue name is required' });
    }
    const item = await Venue.create({
      name,
      address: address || '',
      locationUrl: locationUrl || '',
      createdBy: username || 'admin'
    });
    res.status(201).json(item);
  } catch (error) {
    console.error('Create venue error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

export async function updateVenue(req, res) {
  const { id } = req.params;
  const { name, address, locationUrl } = req.body;
  try {
    const item = await Venue.findById(id);
    if (!item) {
      return res.status(404).json({ error: 'Venue not found' });
    }
    if (name !== undefined) item.name = name;
    if (address !== undefined) item.address = address;
    if (locationUrl !== undefined) item.locationUrl = locationUrl;
    await item.save();
    res.json(item);
  } catch (error) {
    console.error('Update venue error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteVenue(req, res) {
  const { id } = req.params;
  try {
    const item = await Venue.findById(id);
    if (!item) {
      return res.status(404).json({ error: 'Venue not found' });
    }
    await Venue.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete venue error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
