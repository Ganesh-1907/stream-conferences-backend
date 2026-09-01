import mongoose from 'mongoose';

const collaboratorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  logo: { type: String, default: '' },
  description: { type: String, default: '' },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const Collaborator = mongoose.models.Collaborator || mongoose.model('Collaborator', collaboratorSchema);
