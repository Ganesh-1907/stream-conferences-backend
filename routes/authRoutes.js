import { Router } from 'express';
import { login, forgotPassword, resetPassword, registerMentor, changePassword, toggleMentorStatus } from '../controllers/authController.js';
import { requireUser, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/register-mentor', requireUser, requireAdmin, registerMentor);
router.post('/change-password', requireUser, changePassword);
router.put('/mentors/:username/toggle-status', requireUser, requireAdmin, toggleMentorStatus);

export default router;
