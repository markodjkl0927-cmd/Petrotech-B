import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { trackingController } from '../controllers/tracking.controller';

const router = Router();

// All routes require authentication (customer/admin/driver)
router.use(authenticate);

// Reverse geocode driver location to a human-readable label
router.get('/reverse', trackingController.reverse);

export default router;

