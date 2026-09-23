import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatSession', required: false, index: true },
  conferenceId: { type: String, index: true, default: '' },
  sender: { type: String, default: 'visitor' },
  senderName: { type: String, default: '' },
  senderEmail: { type: String, default: '' },
  senderPhone: { type: String, default: '' },
  senderCountry: { type: String, default: '' },
  senderRole: { type: String, default: 'attendee' },
  text: { type: String, default: '' },
  message: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

export const ChatMessage = mongoose.models.ChatMessage || mongoose.model('ChatMessage', chatMessageSchema);
