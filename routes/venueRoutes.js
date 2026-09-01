import { Router } from 'express';
import {
  listVenues,
  createVenue,
  updateVenue,
  deleteVenue
} from '../controllers/venueController.js';
import { requireUser, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', listVenues);
router.post('/', requireUser, requireAdmin, createVenue);
router.put('/:id', requireUser, requireAdmin, updateVenue);
router.delete('/:id', requireUser, requireAdmin, deleteVenue);

export default router;
