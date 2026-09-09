import mongoose from 'mongoose';
import { User } from './models/User.js';
import { Conference } from './models/Conference.js';
import { Webinar } from './models/Webinar.js';
import { generateSlug, sanitizeSubdomain } from './services/slug.js';
import { ensureInitialCohort, backfillCohortContent } from './services/cohortService.js';

const MONGO_URI = process.env.DATABASE_URL || 'mongodb://localhost:27017/stream-conf';

export async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`[Database] Connected to MongoDB at: ${MONGO_URI}`);
    await seedUsers();
    await migrateEventDates();
    await migrateEventSites();
    await migrateCourseCohorts();
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

    // Backfill slugs for documents created before the slug field existed
    const confsNoSlug = await Conference.find({ slug: { $exists: false } });
    for (const c of confsNoSlug) {
      c.slug = generateSlug(c.title || 'conference', 'conf');
      await c.save();
    }
    if (confsNoSlug.length) console.log(`[Database] Backfilled slug for ${confsNoSlug.length} conference(s)`);
  } catch (err) {
    console.error('[Database] eventDate migration failed:', err);
  }
}

// Backfill subdomain + startDate/endDate for legacy events so subdomain routing works on existing data.
async function migrateEventSites() {
  try {
    const confs = await Conference.find({ subdomain: { $exists: false } });
    for (const c of confs) {
      const base = sanitizeSubdomain(c.subdomain || c.slug || c.title || 'conference');
      let candidate = base;
      let suffix = 2;
      while (await Conference.findOne({ subdomain: candidate, _id: { $ne: c._id } })) {
        candidate = `${base}-${suffix}`;
        suffix += 1;
      }
      c.subdomain = candidate;
      if (!c.startDate) c.startDate = c.eventDate;
      if (!c.endDate) c.endDate = c.eventDate;
      await c.save();
    }
    if (confs.length) console.log(`[Database] Backfilled subdomain for ${confs.length} conference(s)`);
  } catch (err) {
    console.error('[Database] event site migration failed:', err);
  }
}

// Backfill an initial cohort (Year = course year, Batch = 1) for every course that has none.
async function migrateCourseCohorts() {
  try {
    let conferenceCount = 0;
    const conferences = await Conference.find({ currentCohortId: null });
    for (const c of conferences) {
      await ensureInitialCohort('conference', c);
      conferenceCount += 1;
    }

    let webinarCount = 0;
    const webinars = await Webinar.find({ currentCohortId: null });
    for (const w of webinars) {
      await ensureInitialCohort('webinar', w);
      webinarCount += 1;
    }

    if (conferenceCount || webinarCount) {
      console.log(`[Database] Backfilled initial cohort for ${conferenceCount} conference(s) and ${webinarCount} webinar(s)`);
    }

    const contentCount = await backfillCohortContent();
    if (contentCount) {
      console.log(`[Database] Backfilled cohort content for ${contentCount} cohort(s)`);
    }
  } catch (err) {
    console.error('[Database] course cohort migration failed:', err);
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
