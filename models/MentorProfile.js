import mongoose from 'mongoose';

const educationSchema = new mongoose.Schema({
  degree: { type: String, default: '' },
  institution: { type: String, default: '' },
  year: { type: String, default: '' }
});

const experienceSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  organization: { type: String, default: '' },
  duration: { type: String, default: '' },
  description: { type: String, default: '' }
});

const certificationSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  issuer: { type: String, default: '' },
  year: { type: String, default: '' }
});

const mentorProfileSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  fullName: { type: String, default: '' },
  title: { type: String, default: '' },
  bio: { type: String, default: '' },
  avatar: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  location: { type: String, default: '' },
  linkedin: { type: String, default: '' },
  website: { type: String, default: '' },
  expertise: { type: [String], default: [] },
  education: { type: [educationSchema], default: [] },
  experiences: { type: [experienceSchema], default: [] },
  certifications: { type: [certificationSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const MentorProfile = mongoose.models.MentorProfile || mongoose.model('MentorProfile', mentorProfileSchema);
