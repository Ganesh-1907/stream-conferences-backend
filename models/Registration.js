import mongoose from 'mongoose';

const registrationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  institution: { type: String, required: true },
  country: { type: String, required: true },
  category: { type: String, required: true },
  presentingAbstract: { type: String, required: true },
  eventId: { type: String },
  eventType: { type: String, enum: ['conference', 'webinar'], default: 'conference' },
  eventTitle: { type: String },
  eventSlug: { type: String },
  paymentStatus: { type: String, enum: ['unpaid', 'paid', 'pending'], default: 'unpaid' },
  createdAt: { type: Date, default: Date.now }
});

export const Registration = mongoose.models.Registration || mongoose.model('Registration', registrationSchema);
