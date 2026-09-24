import { Router } from 'express';
import {
  listMentors,
  getMentorByUsername,
  getMyProfile,
  upsertMyProfile,
  adminUpdateMentor,
  adminDeleteMentor
} from '../controllers/mentorProfileController.js';
import { requireUser, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', listMentors);
router.get('/me', requireUser, getMyProfile);
router.put('/me', requireUser, upsertMyProfile);
router.put('/:username', requireUser, requireAdmin, adminUpdateMentor);
router.delete('/:username', requireUser, requireAdmin, adminDeleteMentor);
router.get('/:username', getMentorByUsername);

export default router;
