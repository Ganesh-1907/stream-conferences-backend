import { Collaborator } from '../models/Collaborator.js';
import { getUserContext } from '../middleware/auth.js';

export async function listCollaborators(req, res) {
  try {
    const list = await Collaborator.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    console.error('Fetch collaborators error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createCollaborator(req, res) {
  const { username } = getUserContext(req);
  const { name, logo, description } = req.body;
  try {
    if (!name) {
      return res.status(400).json({ error: 'Collaborator name is required' });
    }
    const item = await Collaborator.create({
      name,
      logo: logo || '',
      description: description || '',
      createdBy: username
    });
    res.status(201).json(item);
  } catch (error) {
    console.error('Create collaborator error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateCollaborator(req, res) {
  const { id } = req.params;
  const { name, logo, description } = req.body;
  try {
    const item = await Collaborator.findById(id);
    if (!item) {
      return res.status(404).json({ error: 'Collaborator not found' });
    }
    if (name !== undefined) item.name = name;
    if (logo !== undefined) item.logo = logo;
    if (description !== undefined) item.description = description;
    await item.save();
    res.json(item);
  } catch (error) {
    console.error('Update collaborator error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteCollaborator(req, res) {
  const { id } = req.params;
  try {
    const item = await Collaborator.findById(id);
    if (!item) {
      return res.status(404).json({ error: 'Collaborator not found' });
    }
    await Collaborator.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete collaborator error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
