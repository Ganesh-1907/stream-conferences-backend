import { Router } from 'express';
import { listPeople } from '../controllers/peopleController.js';

const router = Router();

router.get('/', listPeople);

export default router;
