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

const router = Router();

router.get('/', (req, res) => {
  res.json({ message: 'Stream Conferences API', version: '1.0.0' });
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
router.use('/files', fileRoutes);
router.use('/venues', venueRoutes);
router.use('/media-partners', mediaPartnerRoutes);
router.use('/collaborators', collaboratorRoutes);
router.use('/exhibitors', exhibitorRoutes);
router.use('/mentors', mentorProfileRoutes);
router.use('/people', peopleRoutes);
router.use('/chat', chatRoutes);

export default router;
