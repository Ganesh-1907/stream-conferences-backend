import mongoose from 'mongoose';

const brochureRequestSchema = new mongoose.Schema({
  title: { type: String },
  fullName: { type: String },
  firstName: { type: String },
  lastName: { type: String },
  email: { type: String, required: true },
  phone: { type: String },
  institution: { type: String },
  designation: { type: String },
  address: { type: String },
  country: { type: String },
  eventId: { type: String },
  eventType: { type: String, enum: ['conference', 'webinar'], default: 'conference' },
  eventTitle: { type: String },
  eventSlug: { type: String },
  cohortId: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export const BrochureRequest = mongoose.models.BrochureRequest || mongoose.model('BrochureRequest', brochureRequestSchema);
