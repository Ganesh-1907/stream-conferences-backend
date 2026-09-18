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
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

router.get('/', requireAdmin, listAbstracts);
router.post('/submit', (req, res, next) => {
  upload.single('abstractFile')(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Abstract file exceeds 5MB limit. Please compress to 5MB or less.' });
    }
    if (err) {
      return res.status(400).json({ error: err.message || 'File upload error' });
    }
    next();
  });
}, submitAbstract);
router.post('/:id/approve', requireAdmin, approveAbstract);
router.post('/:id/reject', requireAdmin, rejectAbstract);

export default router;
