import mongoose from 'mongoose';

const courseCohortSchema = new mongoose.Schema({
  courseType: { type: String, enum: ['conference', 'webinar'], required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, required: true },
  cohortId: { type: String, unique: true, sparse: true },
  year: {
    type: Number,
    required: true,
    min: 2000,
    max: 2100,
  },
  batchNo: { type: Number, required: true, default: 1, min: 1 },
  title: { type: String, default: '' },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  subdomain: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  assignedMentor: { type: String, default: null },
  status: {
    type: String,
    enum: ['draft', 'upcoming', 'active', 'completed', 'archived'],
    default: 'upcoming',
  },
  isCurrent: { type: Boolean, default: false },
  content: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

courseCohortSchema.index(
  { courseType: 1, courseId: 1, year: 1, batchNo: 1 },
  { unique: true }
);

// Only one current cohort per course (courseType + courseId).
courseCohortSchema.index(
  { courseType: 1, courseId: 1, isCurrent: 1 },
  { unique: true, partialFilterExpression: { isCurrent: true } }
);

export const CourseCohort =
  mongoose.models.CourseCohort || mongoose.model('CourseCohort', courseCohortSchema);
