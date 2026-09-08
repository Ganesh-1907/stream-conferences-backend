import { Router } from 'express';
import { listBrochureRequests, createBrochureRequest } from '../controllers/brochureController.js';

const router = Router();

router.get('/', listBrochureRequests);
router.post('/', createBrochureRequest);

export default router;
