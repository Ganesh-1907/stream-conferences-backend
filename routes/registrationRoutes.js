import { Router } from 'express';
import {
  listRegistrations,
  registerParticipant,
  resolveRegistrationLink
} from '../controllers/registrationController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAdmin, listRegistrations);
router.get('/link/:slug', resolveRegistrationLink);
router.post('/register', registerParticipant);

export default router;
