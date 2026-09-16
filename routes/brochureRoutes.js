import { Router } from 'express';
import { 
  listBrochureRequests, 
  createBrochureRequest, 
  getMainBrochure, 
  saveMainBrochure, 
  deleteMainBrochure 
} from '../controllers/brochureController.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.get('/', listBrochureRequests);
router.post('/', createBrochureRequest);

router.get('/main', getMainBrochure);
router.post('/main', requireUser, saveMainBrochure);
router.delete('/main', requireUser, deleteMainBrochure);

export default router;
