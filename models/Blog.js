import mongoose from 'mongoose';
import { nextEventId } from '../services/idGenerator.js';

const blogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  label: { type: String, required: true },
  copy: { type: String, required: true },
  content: { type: String, required: true },
  bannerUrl: { type: String, default: '' },
  eventId: { type: String, unique: true },
  announcedBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

blogSchema.pre('save', async function (next) {
  if (!this.eventId) {
    this.eventId = await nextEventId(this.constructor, 'SCB');
  }
  next();
});

export const Blog = mongoose.models.Blog || mongoose.model('Blog', blogSchema);
