import mongoose from 'mongoose';

const blogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  label: { type: String, required: true },
  copy: { type: String, required: true },
  content: { type: String, required: true },
  bannerUrl: { type: String, default: '' },
  announcedBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const Blog = mongoose.models.Blog || mongoose.model('Blog', blogSchema);
