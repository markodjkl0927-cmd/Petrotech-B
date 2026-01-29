import { Router } from 'express';
import { chargingController } from '../controllers/charging.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all pricing options
router.get('/pricing', chargingController.getAllPricing);

// Get pricing for specific duration
router.get('/pricing/:duration', chargingController.getPricing);

// Create charging order
router.post('/', chargingController.create);

// Get all orders
router.get('/', chargingController.getOrders);

// Get order by ID
router.get('/:id', chargingController.getOrderById);

// Update order status (admin/driver only)
router.patch('/:id/status', chargingController.updateStatus);

// Cancel order
router.delete('/:id', chargingController.cancel);

export default router;
