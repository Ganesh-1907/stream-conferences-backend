import mongoose from 'mongoose';

const abstractSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  name: { type: String },
  email: { type: String, required: true },
  phone: { type: String },
  institution: { type: String },
  country: { type: String },
  abstractFile: { type: String },
  track: { type: String },
  summary: { type: String },
  eventId: { type: String },
  eventType: { type: String, enum: ['conference', 'webinar'], default: 'conference' },
  eventTitle: { type: String },
  eventSlug: { type: String },
  cohortId: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reviewedAt: { type: Date },
  rejectionReason: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export const Abstract = mongoose.models.Abstract || mongoose.model('Abstract', abstractSchema);
