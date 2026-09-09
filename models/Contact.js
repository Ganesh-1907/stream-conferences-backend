import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  subject: { type: String },
  conference: { type: String },
  eventId: { type: String },
  eventType: { type: String, enum: ['conference', 'webinar'] },
  eventTitle: { type: String },
  eventSlug: { type: String },
  cohortId: { type: String },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const Contact = mongoose.models.Contact || mongoose.model('Contact', contactSchema);
