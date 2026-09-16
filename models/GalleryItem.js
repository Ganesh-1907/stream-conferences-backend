import mongoose from 'mongoose';

const galleryItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  image: { type: String, required: true },
  createdBy: { type: String, default: 'admin' },
  createdAt: { type: Date, default: Date.now }
});

export const GalleryItem = mongoose.models.GalleryItem || mongoose.model('GalleryItem', galleryItemSchema);
