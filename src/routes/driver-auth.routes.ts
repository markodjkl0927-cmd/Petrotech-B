import { Router } from 'express';
import { driverAuthController } from '../controllers/driver-auth.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Driver login
router.post('/login', driverAuthController.login);

// One-time activation (invite token -> set password)
router.post('/activate', driverAuthController.activate);

// Driver profile (requires DRIVER token)
router.get('/me', authenticate, authorize('DRIVER'), driverAuthController.me);

export default router;

