import { Router } from 'express';
import {
  listMentors,
  getMentorByUsername,
  getMyProfile,
  upsertMyProfile
} from '../controllers/mentorProfileController.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.get('/', listMentors);
router.get('/me', requireUser, getMyProfile);
router.put('/me', requireUser, upsertMyProfile);
router.get('/:username', getMentorByUsername);

export default router;
