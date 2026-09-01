import { Router } from 'express';
import {
  listConferences,
  getConference,
  createConference,
  updateConference,
  deleteConference,
  getConferenceParticipants,
  getConferenceAbstracts,
  getConferenceEnquiries
} from '../controllers/conferenceController.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.get('/', listConferences);
router.get('/:id', getConference);
router.get('/:id/participants', requireUser, getConferenceParticipants);
router.get('/:id/abstracts', requireUser, getConferenceAbstracts);
router.get('/:id/enquiries', requireUser, getConferenceEnquiries);
router.post('/', requireUser, createConference);
router.put('/:id', requireUser, updateConference);
router.delete('/:id', requireUser, deleteConference);

export default router;
