import { Router } from 'express';
import {
  listWebinars,
  getWebinar,
  createWebinar,
  updateWebinar,
  deleteWebinar,
  getWebinarParticipants,
  getWebinarAbstracts,
  getWebinarEnquiries
} from '../controllers/webinarController.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.get('/', listWebinars);
router.get('/:id', getWebinar);
router.get('/:id/participants', requireUser, getWebinarParticipants);
router.get('/:id/abstracts', requireUser, getWebinarAbstracts);
router.get('/:id/enquiries', requireUser, getWebinarEnquiries);
router.post('/', requireUser, createWebinar);
router.put('/:id', requireUser, updateWebinar);
router.delete('/:id', requireUser, deleteWebinar);

export default router;
