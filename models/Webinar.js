import mongoose from 'mongoose';
import { nextEventId } from '../services/idGenerator.js';

const feeEntrySchema = new mongoose.Schema({
  type: { type: String, required: true },
  dateLabel: { type: String, default: '' },
  usd: { type: Number, default: 0 },
  gbp: { type: Number, default: 0 },
  eur: { type: Number, default: 0 }
}, { _id: false });

const trackReferenceLinkSchema = new mongoose.Schema({
  label: { type: String, default: '' },
  url: { type: String, required: true }
});

const trackSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  image: { type: String },
  referenceLinks: { type: [trackReferenceLinkSchema], default: [] }
});

const itineraryItemSchema = new mongoose.Schema({
  time: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  speaker: { type: String },
  track: { type: String },
  type: { type: String, enum: ['session', 'break', 'keynote', 'panel', 'workshop', 'networking'], default: 'session' }
});

const speakerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  degree: { type: String, default: '' },
  designation: { type: String },
  organization: { type: String },
  bio: { type: String },
  avatar: { type: String },
  linkedin: { type: String },
  twitter: { type: String },
  website: { type: String },
  topic: { type: String },
  isKeynote: { type: Boolean, default: false }
});

const programDaySchema = new mongoose.Schema({
  dayNumber: { type: Number, required: true },
  date: { type: Date },
  title: { type: String },
  description: { type: String },
  sessions: [itineraryItemSchema]
});

const faqSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer: { type: String, required: true },
  category: { type: String, default: 'general' },
  order: { type: Number, default: 0 }
});

const organizingCommitteeMemberSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  image: { type: String, default: '' },
  degree: { type: String, default: '' },
  specialization: { type: String, default: '' },
  country: { type: String, default: '' },
  biography: { type: String, default: '' },
  researchArea: { type: String, default: '' }
}, { _id: false });

const partnerSchema = new mongoose.Schema({
  title: { type: String },
  name: { type: String },
  logo: { type: String, default: '' },
  order: { type: Number, default: 0 }
}, { strict: false });

const webinarSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String },
  theme: { type: String, default: '' },
  themeColor: { type: String, default: '' },
  day: { type: String, default: '' },
  month: { type: String, default: '' },
  location: { type: String, default: '' },
  venue: { type: String },
  venueAddress: { type: String },
  venueMapUrl: { type: String },
  eventDate: { type: Date, default: null },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  subdomain: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  assignedMentor: { type: String, default: null },
  speaker: { type: String, default: '' },
  startTime: { type: String },
  endTime: { type: String },
  brochureUrl: { type: String },
  bannerUrl: { type: String },
  logoUrl: { type: String },
  headerBanners: { type: [String], default: [] },
  fees: { type: [feeEntrySchema], default: [] },
  tracks: { type: [trackSchema], default: [] },
  organizerContact: {
    name: { type: String },
    email: { type: String },
    phone: { type: String },
    website: { type: String },
    address: { type: String }
  },
  eventId: { type: String, unique: true },
  currentCohortId: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseCohort', default: null },
  announcedBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  
  // New fields for conference website tabs
  speakers: { type: [speakerSchema], default: [] },
  program: { type: [programDaySchema], default: [] },
  faqs: { type: [faqSchema], default: [] },
  sponsors: { type: [partnerSchema], default: [] },
  exhibitors: { type: [partnerSchema], default: [] },
  partners: { type: [partnerSchema], default: [] },
  mediaPartners: { type: [partnerSchema], default: [] },
  guidelines: { type: String },
  scientificProgramUrl: { type: String, default: '' },
  termsAndConditions: { type: String },
  organizingCommittee: { type: [organizingCommitteeMemberSchema], default: [] },
  
  // Venue details for schedule and venue tab
  venueDetails: {
    venueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', default: null },
    name: { type: String },
    address: { type: String, default: '' },
    locationUrl: { type: String, default: '' },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    startTime: { type: String },
    endTime: { type: String },
    mainImage: { type: String, default: '' },
    subImages: { type: [String], default: [] },
    description: { type: String },
    images: { type: [String], default: [] },
    moreInfo: { type: String }
  }
}, { toJSON: { virtuals: true }, toObject: { virtuals: true } });

// Auto-generate W-prefix sequential eventId if not provided
webinarSchema.pre('save', async function (next) {
  if (!this.eventId) {
    this.eventId = await nextEventId(this.constructor, 'SCW');
  }
  next();
});

// Auto-compute status (upcoming / past) from the actual event date
webinarSchema.virtual('date').get(function () {
  if (!this.eventDate) return 'upcoming';
  return new Date(this.eventDate).getTime() >= Date.now() ? 'upcoming' : 'past';
});

export const Webinar = mongoose.models.Webinar || mongoose.model('Webinar', webinarSchema);
