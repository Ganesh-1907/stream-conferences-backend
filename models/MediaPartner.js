import mongoose from 'mongoose';

const mediaPartnerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  logo: { type: String, default: '' },
  description: { type: String, default: '' },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const MediaPartner = mongoose.models.MediaPartner || mongoose.model('MediaPartner', mediaPartnerSchema);
