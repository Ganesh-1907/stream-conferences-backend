import mongoose from 'mongoose';

const chatSessionSchema = new mongoose.Schema({
  visitorId: { type: String, required: true },
  conferenceId: { type: String, default: null, index: true },
  eventId: { type: String, default: null },
  conferenceTitle: { type: String, default: '' },
  scope: { type: String, enum: ['main', 'conference'], default: 'main', index: true },
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

chatSessionSchema.index({ visitorId: 1, conferenceId: 1 });

export const ChatSession = mongoose.models.ChatSession || mongoose.model('ChatSession', chatSessionSchema);

