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
import galleryRoutes from './galleryRoutes.js';
import { Conference } from '../models/Conference.js';
import { Webinar } from '../models/Webinar.js';
import { Blog } from '../models/Blog.js';
import { Registration } from '../models/Registration.js';
import { Abstract } from '../models/Abstract.js';
import { Order } from '../models/Order.js';
import { CourseCohort } from '../models/CourseCohort.js';

const router = Router();

function getUserContext(req) {
  return { role: req.headers['x-user-role'] || 'guest', username: req.headers['x-user-name'] || '' };
}

router.get('/', (req, res) => {
  res.json({ message: 'Stream Conferences API', version: '1.0.0' });
});

router.get('/stats', async (req, res) => {
  try {
    const { role, username } = getUserContext(req);
    const now = new Date();

    let confIds = null;
    let webIds = null;

    if (role === 'mentor' && username) {
      const confCohorts = await CourseCohort.find({ courseType: 'conference', assignedMentor: username }).select('courseId').lean();
      const webCohorts = await CourseCohort.find({ courseType: 'webinar', assignedMentor: username }).select('courseId').lean();
      const confParentIds = await Conference.find({ assignedMentor: username }).select('_id').lean();
      const webParentIds = await Webinar.find({ assignedMentor: username }).select('_id').lean();
      confIds = [...new Set([...confCohorts.map(c => c.courseId.toString()), ...confParentIds.map(p => p._id.toString())])];
      webIds = [...new Set([...webCohorts.map(c => c.courseId.toString()), ...webParentIds.map(p => p._id.toString())])];
      if (!confIds.length && !webIds.length) {
        return res.json({
          counts: { conferences: 0, webinars: 0, blogs: 0, registrations: 0, abstracts: 0, confUpcoming: 0, confPast: 0, webUpcoming: 0, webPast: 0 },
          revenue: { total: 0, paidOrders: 0, totalOrders: 0 },
          registrations: { paid: 0, unpaid: 0, pending: 0 },
          monthly: { conferences: [], webinars: [] },
          yearly: { conferences: [], webinars: [] },
          recent: { conferences: [], webinars: [], blogs: [], registrations: [], abstracts: [] },
        });
      }
    }

    const mentorConfFilter = role === 'mentor' ? { _id: { $in: confIds || [] } } : {};
    const mentorWebFilter = role === 'mentor' ? { _id: { $in: webIds || [] } } : {};
    const mentorOrAssigned = role === 'mentor' ? { $or: [{ announcedBy: username }, { assignedMentor: username }] } : {};
    const blogFilter = role === 'mentor' ? { announcedBy: username } : {};

    const [confCount, webCount, blogCount, regCount, absCount, confUpcoming, confPast, webUpcoming, webPast] = await Promise.all([
      Conference.countDocuments(mentorConfFilter),
      Webinar.countDocuments(mentorWebFilter),
      Blog.countDocuments(blogFilter),
      Registration.countDocuments(mentorOrAssigned),
      Abstract.countDocuments(mentorOrAssigned),
      Conference.countDocuments({ ...mentorConfFilter, eventDate: { $gte: now } }),
      Conference.countDocuments({ ...mentorConfFilter, eventDate: { $lt: now, $ne: null } }),
      Webinar.countDocuments({ ...mentorWebFilter, eventDate: { $gte: now } }),
      Webinar.countDocuments({ ...mentorWebFilter, eventDate: { $lt: now, $ne: null } }),
    ]);

    const [recentConfs, recentWebs, recentBlogs, recentRegs, recentAbs] = await Promise.all([
      Conference.find(mentorConfFilter).sort({ createdAt: -1 }).limit(3).select('title date eventDate createdAt'),
      Webinar.find(mentorWebFilter).sort({ createdAt: -1 }).limit(3).select('title date eventDate createdAt'),
      Blog.find(blogFilter).sort({ createdAt: -1 }).limit(3).select('title createdAt'),
      Registration.find(mentorOrAssigned).sort({ createdAt: -1 }).limit(5).select('name email category country createdAt'),
      Abstract.find(mentorOrAssigned).sort({ createdAt: -1 }).limit(5).select('name email track createdAt'),
    ]);

    const [paidOrders, totalOrders] = await Promise.all([
      Order.find({ ...mentorOrAssigned, status: 'paid' }).select('amount eventType createdAt'),
      Order.countDocuments(mentorOrAssigned),
    ]);
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
    const paidCount = paidOrders.length;

    const yearStart = new Date(now.getFullYear(), 0, 1);
    const [confMonthly, webMonthly] = await Promise.all([
      Conference.aggregate([
        { $match: { ...mentorConfFilter, createdAt: { $gte: yearStart } } },
        { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } } },
      ]),
      Webinar.aggregate([
        { $match: { ...mentorWebFilter, createdAt: { $gte: yearStart } } },
        { $group: { _id: { $month: '$createdAt' }, count: { $sum: 1 } } },
      ]),
    ]);

    const fiveYearsAgo = new Date(now.getFullYear() - 4, 0, 1);
    const [confYearly, webYearly] = await Promise.all([
      Conference.aggregate([
        { $match: { ...mentorConfFilter, createdAt: { $gte: fiveYearsAgo } } },
        { $group: { _id: { $year: '$createdAt' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Webinar.aggregate([
        { $match: { ...mentorWebFilter, createdAt: { $gte: fiveYearsAgo } } },
        { $group: { _id: { $year: '$createdAt' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const [regPaid, regUnpaid, regPending] = await Promise.all([
      Registration.countDocuments({ ...mentorOrAssigned, paymentStatus: 'paid' }),
      Registration.countDocuments({ ...mentorOrAssigned, paymentStatus: 'unpaid' }),
      Registration.countDocuments({ ...mentorOrAssigned, paymentStatus: 'pending' }),
    ]);

    res.json({
      counts: { conferences: confCount, webinars: webCount, blogs: blogCount, registrations: regCount, abstracts: absCount, confUpcoming, confPast, webUpcoming, webPast },
      revenue: { total: totalRevenue, paidOrders: paidCount, totalOrders },
      registrations: { paid: regPaid, unpaid: regUnpaid, pending: regPending },
      monthly: { conferences: confMonthly, webinars: webMonthly },
      yearly: { conferences: confYearly, webinars: webYearly },
      recent: { conferences: recentConfs, webinars: recentWebs, blogs: recentBlogs, registrations: recentRegs, abstracts: recentAbs },
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

router.use('/auth', authRoutes);
router.use('/conferences', conferenceRoutes);
router.use('/webinars', webinarRoutes);
router.use('/blogs', blogRoutes);
router.use('/registrations', registrationRoutes);
router.use('/abstracts', abstractRoutes);
router.use('/contacts', contactRoutes);
router.use('/orders', orderRoutes);
router.use('/uploads', uploadRoutes);
router.use('/upload', uploadRoutes);
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
router.use('/brochure', brochureRoutes);
router.use('/cohorts', cohortRoutes);
router.use('/gallery', galleryRoutes);

export default router;
