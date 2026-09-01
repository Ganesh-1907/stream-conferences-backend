import { Router } from 'express';
import multer from 'multer';
import {
  listAbstracts,
  submitAbstract,
  approveAbstract,
  rejectAbstract
} from '../controllers/abstractController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20 MB
});

router.get('/', requireAdmin, listAbstracts);
router.post('/submit', upload.single('abstractFile'), submitAbstract);
router.post('/:id/approve', requireAdmin, approveAbstract);
router.post('/:id/reject', requireAdmin, rejectAbstract);

export default router;
