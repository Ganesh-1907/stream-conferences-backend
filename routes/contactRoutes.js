import { Router } from 'express';
import { listContacts, sendContact, updateContactStatus } from '../controllers/contactController.js';
import { requireAdmin, requireUser } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAdmin, listContacts);
router.put('/:id/status', requireUser, updateContactStatus);
router.post('/send', sendContact);

export default router;
