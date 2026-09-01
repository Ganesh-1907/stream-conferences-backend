import mongoose from 'mongoose';

const exhibitorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  logo: { type: String, default: '' },
  description: { type: String, default: '' },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const Exhibitor = mongoose.models.Exhibitor || mongoose.model('Exhibitor', exhibitorSchema);
