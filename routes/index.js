import { Router } from 'express';
import authRoutes from './authRoutes.js';
import conferenceRoutes from './conferenceRoutes.js';
import webinarRoutes from './webinarRoutes.js';
import blogRoutes from './blogRoutes.js';
import registrationRoutes from './registrationRoutes.js';
import abstractRoutes from './abstractRoutes.js';
import contactRoutes from './contactRoutes.js';
import orderRoutes from './orderRoutes.js';
import uploadRoutes from './uploadRoutes.js';
import fileRoutes from './fileRoutes.js';
import venueRoutes from './venueRoutes.js';
import mediaPartnerRoutes from './mediaPartnerRoutes.js';
import collaboratorRoutes from './collaboratorRoutes.js';
import exhibitorRoutes from './exhibitorRoutes.js';
import mentorProfileRoutes from './mentorProfileRoutes.js';
import peopleRoutes from './peopleRoutes.js';
import chatRoutes from './chatRoutes.js';
import eventRoutes from './eventRoutes.js';
import brochureRoutes from './brochureRoutes.js';
import cohortRoutes from './cohortRoutes.js';
import { Conference } from '../models/Conference.js';
import { Webinar } from '../models/Webinar.js';
import { Blog } from '../models/Blog.js';
import { Registration } from '../models/Registration.js';
import { Abstract } from '../models/Abstract.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({ message: 'Stream Conferences API', version: '1.0.0' });
});

router.get('/stats', async (req, res) => {
  try {
    const { role, username } = getUserContext(req);
    const mentorFilter = role === 'mentor' ? { announcedBy: username } : {};
    const mentorOrAssigned = role === 'mentor' ? { $or: [{ announcedBy: username }, { assignedMentor: username }] } : {};
    const now = new Date();

    const [confCount, webCount, blogCount, regCount, absCount, confUpcoming, confPast, webUpcoming, webPast] = await Promise.all([
      Conference.countDocuments(mentorFilter),
      Webinar.countDocuments(mentorFilter),
      Blog.countDocuments(mentorFilter),
      Registration.countDocuments(mentorOrAssigned),
      Abstract.countDocuments(mentorOrAssigned),
      Conference.countDocuments({ ...mentorFilter, eventDate: { $gte: now } }),
      Conference.countDocuments({ ...mentorFilter, eventDate: { $lt: now, $ne: null } }),
      Webinar.countDocuments({ ...mentorFilter, eventDate: { $gte: now } }),
      Webinar.countDocuments({ ...mentorFilter, eventDate: { $lt: now, $ne: null } }),
    ]);

    const [recentConfs, recentWebs, recentBlogs, recentRegs, recentAbs] = await Promise.all([
      Conference.find(mentorFilter).sort({ createdAt: -1 }).limit(3).select('title date eventDate createdAt'),
      Webinar.find(mentorFilter).sort({ createdAt: -1 }).limit(3).select('title date eventDate createdAt'),
      Blog.find(mentorFilter).sort({ createdAt: -1 }).limit(3).select('title createdAt'),
      Registration.find(mentorOrAssigned).sort({ createdAt: -1 }).limit(5).select('name email category country createdAt'),
      Abstract.find(mentorOrAssigned).sort({ createdAt: -1 }).limit(5).select('name email track createdAt'),
    ]);

    res.json({
      counts: { conferences: confCount, webinars: webCount, blogs: blogCount, registrations: regCount, abstracts: absCount, confUpcoming, confPast, webUpcoming, webPast },
      recent: { conferences: recentConfs, webinars: recentWebs, blogs: recentBlogs, registrations: recentRegs, abstracts: recentAbs },
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

function getUserContext(req) {
  return { role: req.headers['x-user-role'] || 'guest', username: req.headers['x-user-name'] || '' };
}

router.use('/auth', authRoutes);
router.use('/conferences', conferenceRoutes);
router.use('/webinars', webinarRoutes);
router.use('/blogs', blogRoutes);
router.use('/registrations', registrationRoutes);
router.use('/abstracts', abstractRoutes);
router.use('/contacts', contactRoutes);
router.use('/orders', orderRoutes);
router.use('/uploads', uploadRoutes);
router.use('/files', fileRoutes);
router.use('/venues', venueRoutes);
router.use('/media-partners', mediaPartnerRoutes);
router.use('/collaborators', collaboratorRoutes);
router.use('/exhibitors', exhibitorRoutes);
router.use('/mentors', mentorProfileRoutes);
router.use('/people', peopleRoutes);
router.use('/chat', chatRoutes);
router.use('/events', eventRoutes);
router.use('/brochure-requests', brochureRoutes);
router.use('/cohorts', cohortRoutes);

export default router;
