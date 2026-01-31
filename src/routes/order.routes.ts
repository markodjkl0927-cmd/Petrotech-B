import { Router } from 'express';
import { orderController } from '../controllers/order.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate); // All routes require authentication

router.get('/', orderController.getAll);
router.get('/:id/tracking', orderController.getTracking);
router.get('/:id', orderController.getById);
router.post('/', orderController.create);
router.put('/:id/cancel', orderController.cancel);

export default router;

