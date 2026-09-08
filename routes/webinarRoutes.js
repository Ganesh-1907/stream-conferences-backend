import { Router } from 'express';
import {
  listWebinars,
  getWebinar,
  createWebinar,
  updateWebinar,
  deleteWebinar,
  assignWebinarMentor,
  getWebinarDashboard,
  getWebinarParticipants,
  getWebinarPayments,
  getWebinarAbstracts,
  getWebinarEnquiries
} from '../controllers/webinarController.js';
import { requireUser, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', listWebinars);
router.get('/:id', getWebinar);
router.get('/:id/dashboard', requireUser, getWebinarDashboard);
router.get('/:id/participants', requireUser, getWebinarParticipants);
router.get('/:id/payments', requireUser, getWebinarPayments);
router.get('/:id/abstracts', requireUser, getWebinarAbstracts);
router.get('/:id/enquiries', requireUser, getWebinarEnquiries);
router.post('/', requireUser, createWebinar);
router.put('/:id', requireUser, updateWebinar);
router.put('/:id/assign', requireAdmin, assignWebinarMentor);
router.delete('/:id', requireUser, deleteWebinar);

export default router;
