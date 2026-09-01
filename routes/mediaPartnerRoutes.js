import { Router } from 'express';
import {
  listMediaPartners,
  createMediaPartner,
  updateMediaPartner,
  deleteMediaPartner
} from '../controllers/mediaPartnerController.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.get('/', listMediaPartners);
router.post('/', requireUser, createMediaPartner);
router.put('/:id', requireUser, updateMediaPartner);
router.delete('/:id', requireUser, deleteMediaPartner);

export default router;
