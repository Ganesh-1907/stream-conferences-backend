import { Router } from 'express';
import {
  listOrders,
  createOrder,
  verifyOrder,
  orderStatus
} from '../controllers/orderController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAdmin, listOrders);
router.post('/create', createOrder);
router.post('/verify', verifyOrder);
router.get('/status/:id', orderStatus);

export default router;
