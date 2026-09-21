import { Router } from 'express';
import {
  getAbstractTemplate,
  saveAbstractTemplate,
  deleteAbstractTemplate
} from '../controllers/abstractTemplateController.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.get('/main', getAbstractTemplate);
router.post('/main', requireUser, saveAbstractTemplate);
router.delete('/main', requireUser, deleteAbstractTemplate);

export default router;
