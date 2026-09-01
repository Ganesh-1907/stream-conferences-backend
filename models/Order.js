import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  paymentId: { type: String },
  signature: { type: String },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  registrationId: { type: String },
  eventId: { type: String },
  eventType: { type: String, enum: ['conference', 'webinar'], default: 'conference' },
  eventTitle: { type: String },
  eventSlug: { type: String },
  status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  mode: { type: String, enum: ['razorpay', 'mock'], default: 'razorpay' },
  createdAt: { type: Date, default: Date.now }
});

export const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
