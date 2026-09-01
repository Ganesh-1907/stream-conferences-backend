import { Exhibitor } from '../models/Exhibitor.js';
import { getUserContext } from '../middleware/auth.js';

export async function listExhibitors(req, res) {
  try {
    const list = await Exhibitor.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    console.error('Fetch exhibitors error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createExhibitor(req, res) {
  const { username } = getUserContext(req);
  const { name, logo, description } = req.body;
  try {
    if (!name) {
      return res.status(400).json({ error: 'Exhibitor name is required' });
    }
    const item = await Exhibitor.create({
      name,
      logo: logo || '',
      description: description || '',
      createdBy: username
    });
    res.status(201).json(item);
  } catch (error) {
    console.error('Create exhibitor error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateExhibitor(req, res) {
  const { id } = req.params;
  const { name, logo, description } = req.body;
  try {
    const item = await Exhibitor.findById(id);
    if (!item) {
      return res.status(404).json({ error: 'Exhibitor not found' });
    }
    if (name !== undefined) item.name = name;
    if (logo !== undefined) item.logo = logo;
    if (description !== undefined) item.description = description;
    await item.save();
    res.json(item);
  } catch (error) {
    console.error('Update exhibitor error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteExhibitor(req, res) {
  const { id } = req.params;
  try {
    const item = await Exhibitor.findById(id);
    if (!item) {
      return res.status(404).json({ error: 'Exhibitor not found' });
    }
    await Exhibitor.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete exhibitor error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
