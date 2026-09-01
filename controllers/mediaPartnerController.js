import { MediaPartner } from '../models/MediaPartner.js';
import { getUserContext } from '../middleware/auth.js';

export async function listMediaPartners(req, res) {
  try {
    const list = await MediaPartner.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    console.error('Fetch media partners error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createMediaPartner(req, res) {
  const { username } = getUserContext(req);
  const { name, logo, description } = req.body;
  try {
    if (!name) {
      return res.status(400).json({ error: 'Media partner name is required' });
    }
    const item = await MediaPartner.create({
      name,
      logo: logo || '',
      description: description || '',
      createdBy: username
    });
    res.status(201).json(item);
  } catch (error) {
    console.error('Create media partner error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateMediaPartner(req, res) {
  const { id } = req.params;
  const { name, logo, description } = req.body;
  try {
    const item = await MediaPartner.findById(id);
    if (!item) {
      return res.status(404).json({ error: 'Media partner not found' });
    }
    if (name !== undefined) item.name = name;
    if (logo !== undefined) item.logo = logo;
    if (description !== undefined) item.description = description;
    await item.save();
    res.json(item);
  } catch (error) {
    console.error('Update media partner error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteMediaPartner(req, res) {
  const { id } = req.params;
  try {
    const item = await MediaPartner.findById(id);
    if (!item) {
      return res.status(404).json({ error: 'Media partner not found' });
    }
    await MediaPartner.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete media partner error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
