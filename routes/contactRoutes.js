import { Router } from 'express';
import { listContacts, sendContact } from '../controllers/contactController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAdmin, listContacts);
router.post('/send', sendContact);

export default router;
