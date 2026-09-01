import { Router } from 'express';
import {
  listExhibitors,
  createExhibitor,
  updateExhibitor,
  deleteExhibitor
} from '../controllers/exhibitorController.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.get('/', listExhibitors);
router.post('/', requireUser, createExhibitor);
router.put('/:id', requireUser, updateExhibitor);
router.delete('/:id', requireUser, deleteExhibitor);

export default router;
