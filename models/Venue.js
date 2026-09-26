import mongoose from 'mongoose';

const venueSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String, default: '' },
  locationUrl: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  createdBy: { type: String, default: 'admin' },
  createdAt: { type: Date, default: Date.now }
});

export const Venue = mongoose.models.Venue || mongoose.model('Venue', venueSchema);
