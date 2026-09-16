import mongoose from 'mongoose';

const mainBrochureSchema = new mongoose.Schema({
  title: { type: String, default: 'Official Conference Brochure' },
  fileUrl: { type: String, required: true },
  fileName: { type: String, default: 'conference_brochure.pdf' },
}, { timestamps: true });

export const MainBrochure = mongoose.model('MainBrochure', mainBrochureSchema);
