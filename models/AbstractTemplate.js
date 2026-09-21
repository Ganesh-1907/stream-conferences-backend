import mongoose from 'mongoose';

const abstractTemplateSchema = new mongoose.Schema({
  title: { type: String, default: 'Official Abstract Submission Template' },
  fileUrl: { type: String, required: true },
  fileName: { type: String, default: 'abstract-template.docx' },
}, { timestamps: true });

export const AbstractTemplate = mongoose.model('AbstractTemplate', abstractTemplateSchema);
