import { Router } from 'express';
import {
  listCollaborators,
  createCollaborator,
  updateCollaborator,
  deleteCollaborator
} from '../controllers/collaboratorController.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.get('/', listCollaborators);
router.post('/', requireUser, createCollaborator);
router.put('/:id', requireUser, updateCollaborator);
router.delete('/:id', requireUser, deleteCollaborator);

export default router;
