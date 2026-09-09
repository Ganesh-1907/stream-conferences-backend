import { Router } from 'express';
import {
  listConferences,
  getConference,
  createConference,
  updateConference,
  deleteConference,
  assignConferenceMentor,
  getConferenceDashboard,
  getConferenceParticipants,
  getConferencePayments,
  getConferenceAbstracts,
  getConferenceEnquiries
} from '../controllers/conferenceController.js';
import { requireUser, requireAdmin } from '../middleware/auth.js';
import { listCohortsForCourse, createCohortForCourse } from '../controllers/cohortController.js';

const router = Router();

router.get('/', listConferences);
router.get('/:id', getConference);
router.get('/:id/cohorts', listCohortsForCourse('conference'));
router.post('/:id/cohorts', requireUser, createCohortForCourse('conference'));
router.get('/:id/dashboard', requireUser, getConferenceDashboard);
router.get('/:id/participants', requireUser, getConferenceParticipants);
router.get('/:id/payments', requireUser, getConferencePayments);
router.get('/:id/abstracts', requireUser, getConferenceAbstracts);
router.get('/:id/enquiries', requireUser, getConferenceEnquiries);
router.post('/', requireUser, createConference);
router.put('/:id', requireUser, updateConference);
router.put('/:id/assign', requireAdmin, assignConferenceMentor);
router.delete('/:id', requireUser, deleteConference);

export default router;
