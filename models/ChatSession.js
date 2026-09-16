import mongoose from 'mongoose';

const chatSessionSchema = new mongoose.Schema({
  visitorId: { type: String, required: true, unique: true },
  visitorName: { type: String, default: 'Visitor' },
  visitorEmail: { type: String, default: '' },
  visitorPhone: { type: String, default: '' },
  visitorCountry: { type: String, default: '' },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  assignedTo: { type: String, default: null },
  lastMessageAt: { type: Date, default: Date.now },
  unreadByAdmin: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

export const ChatSession = mongoose.models.ChatSession || mongoose.model('ChatSession', chatSessionSchema);
