import { Router } from 'express';
import { getEventBySubdomain } from '../controllers/eventController.js';

const router = Router();

router.get('/by-subdomain/:subdomain', getEventBySubdomain);

export default router;
