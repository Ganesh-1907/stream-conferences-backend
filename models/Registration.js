import mongoose from 'mongoose';

const registrationSchema = new mongoose.Schema({
  title: { type: String },
  fullName: { type: String },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  institution: { type: String, required: true },
  address: { type: String },
  country: { type: String, required: true },
  category: { type: String, required: true },
  presentingAbstract: { type: String, default: 'no' },
  billingInfo: {
    title: { type: String },
    fullName: { type: String },
    email: { type: String },
    phone: { type: String },
    institution: { type: String },
    country: { type: String },
    address: { type: String }
  },
  eventId: { type: String },
  eventType: { type: String, enum: ['conference', 'webinar'], default: 'conference' },
  eventTitle: { type: String },
  eventSlug: { type: String },
  cohortId: { type: String },
  paymentStatus: { type: String, enum: ['unpaid', 'paid', 'pending'], default: 'unpaid' },
  createdAt: { type: Date, default: Date.now }
});

export const Registration = mongoose.models.Registration || mongoose.model('Registration', registrationSchema);
