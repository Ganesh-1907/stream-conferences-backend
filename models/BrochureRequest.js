import mongoose from 'mongoose';

const brochureRequestSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  institution: { type: String },
  country: { type: String },
  eventId: { type: String },
  eventType: { type: String, enum: ['conference', 'webinar'], default: 'conference' },
  eventTitle: { type: String },
  eventSlug: { type: String },
  cohortId: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export const BrochureRequest = mongoose.models.BrochureRequest || mongoose.model('BrochureRequest', brochureRequestSchema);
