import { GalleryItem } from '../models/GalleryItem.js';
import { getUserContext } from '../middleware/auth.js';

export async function listGalleryItems(req, res) {
  try {
    const list = await GalleryItem.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    console.error('Fetch gallery items error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createGalleryItem(req, res) {
  const { username } = getUserContext(req);
  const { title, description, image } = req.body || {};
  try {
    if (!title || !image) {
      return res.status(400).json({ error: 'Title and image are required' });
    }
    const item = await GalleryItem.create({
      title,
      description: description || '',
      image,
      createdBy: username || 'admin'
    });
    res.status(201).json(item);
  } catch (error) {
    console.error('Create gallery item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteGalleryItem(req, res) {
  const { id } = req.params;
  try {
    const item = await GalleryItem.findById(id);
    if (!item) {
      return res.status(404).json({ error: 'Gallery item not found' });
    }
    await GalleryItem.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete gallery item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
