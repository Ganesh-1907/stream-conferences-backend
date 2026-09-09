import { Router } from 'express';
import {
  getCohort,
  updateCohort,
  deleteCohort,
  setCohortCurrent,
  assignCohortMentor,
} from '../controllers/cohortController.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.get('/:id', getCohort);
router.put('/:id', requireUser, updateCohort);
router.put('/:id/set-current', requireUser, setCohortCurrent);
router.put('/:id/assign', requireUser, assignCohortMentor);
router.delete('/:id', requireUser, deleteCohort);

export default router;
