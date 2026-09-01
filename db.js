import mongoose from 'mongoose';
import { User } from './models/User.js';
import { Conference } from './models/Conference.js';
import { Webinar } from './models/Webinar.js';
import { generateSlug } from './services/slug.js';

const MONGO_URI = process.env.DATABASE_URL || 'mongodb://localhost:27017/stream-conf';

export async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`[Database] Connected to MongoDB at: ${MONGO_URI}`);
    await seedUsers();
    await migrateEventDates();
  } catch (error) {
    console.error('[Database] Connection error:', error);
    process.exit(1);
  }
}

// Backfill eventDate for legacy documents that only stored a status ('upcoming'/'past') in `date`
async function migrateEventDates() {
  const now = Date.now();
  const pastDate = new Date(now - 60 * 24 * 60 * 60 * 1000); // ~60 days ago
  const upcomingDate = new Date(now + 60 * 24 * 60 * 60 * 1000); // ~60 days from now

  try {
    const confs = await Conference.find({ eventDate: { $exists: false } });
    for (const c of confs) {
      c.eventDate = c._doc && c._doc.date === 'past' ? pastDate : upcomingDate;
      await c.save();
    }
    if (confs.length) console.log(`[Database] Migrated eventDate for ${confs.length} conference(s)`);

    const webs = await Webinar.find({ eventDate: { $exists: false } });
    for (const w of webs) {
      w.eventDate = w._doc && w._doc.date === 'past' ? pastDate : upcomingDate;
      await w.save();
    }
    if (webs.length) console.log(`[Database] Migrated eventDate for ${webs.length} webinar(s)`);

    // Backfill slugs for documents created before the slug field existed
    const confsNoSlug = await Conference.find({ slug: { $exists: false } });
    for (const c of confsNoSlug) {
      c.slug = generateSlug(c.title || 'conference', 'conf');
      await c.save();
    }
    if (confsNoSlug.length) console.log(`[Database] Backfilled slug for ${confsNoSlug.length} conference(s)`);

    const websNoSlug = await Webinar.find({ slug: { $exists: false } });
    for (const w of websNoSlug) {
      w.slug = generateSlug(w.title || 'webinar', 'web');
      await w.save();
    }
    if (websNoSlug.length) console.log(`[Database] Backfilled slug for ${websNoSlug.length} webinar(s)`);
  } catch (err) {
    console.error('[Database] eventDate migration failed:', err);
  }
}

// Seeding logic
async function seedUsers() {
  try {
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      await User.create({
        username: 'admin',
        password: 'admin123',
        email: process.env.ADMIN_EMAIL || 'admin@streamconferences.com',
        role: 'admin'
      });
      console.log('[Database] Seeded default admin: admin / admin123');
    }

    const mentorExists = await User.findOne({ username: 'mentor' });
    if (!mentorExists) {
      await User.create({
        username: 'mentor',
        password: 'mentor123',
        email: process.env.EMAIL_USER || 'mentor@streamconferences.com',
        role: 'mentor'
      });
      console.log('[Database] Seeded default mentor: mentor / mentor123');
    }
  } catch (err) {
    console.error('[Database] User seeding failed:', err);
  }
}
