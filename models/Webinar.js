import mongoose from 'mongoose';

const feeSchema = new mongoose.Schema({
  label: { type: String, required: true },
  amount: { type: Number, required: true }
});

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

const webinarSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String },
  day: { type: String, required: true },
  month: { type: String, required: true },
  location: { type: String, required: true },
  eventDate: { type: Date, required: true },
  speaker: { type: String, required: true },
  startTime: { type: String },
  endTime: { type: String },
  brochureUrl: { type: String },
  bannerUrl: { type: String },
  logoUrl: { type: String },
  fees: { type: [feeSchema], default: [] },
  tracks: { type: [trackSchema], default: [] },
  organizerContact: {
    name: { type: String },
    email: { type: String },
    phone: { type: String }
  },
  eventId: { type: String, unique: true },
  announcedBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, { toJSON: { virtuals: true }, toObject: { virtuals: true } });

// Auto-generate W-prefix sequential eventId if not provided
webinarSchema.pre('save', async function (next) {
  if (!this.eventId) {
    const latest = await this.constructor
      .findOne({ eventId: /^[Ww]\d+$/ })
      .sort({ eventId: -1 })
      .exec();
    let nextNum = 1000001;
    if (latest && latest.eventId) {
      const match = latest.eventId.match(/^[Ww](\d+)$/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    this.eventId = `W${nextNum}`;
  }
  next();
});

// Auto-compute status (upcoming / past) from the actual event date
webinarSchema.virtual('date').get(function () {
  if (!this.eventDate) return 'upcoming';
  return new Date(this.eventDate).getTime() >= Date.now() ? 'upcoming' : 'past';
});

export const Webinar = mongoose.models.Webinar || mongoose.model('Webinar', webinarSchema);
