import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Create payment intent (requires authentication)
router.post('/create-intent', authenticate, paymentController.createPaymentIntent);

// Confirm payment (requires authentication)
router.post('/confirm', authenticate, paymentController.confirmPayment);

// Webhook endpoint (no authentication - Stripe verifies via signature)
// Note: In production, you should use raw body for webhook verification
// For Express, you might need express.raw({ type: 'application/json' }) middleware
router.post('/webhook', paymentController.handleWebhook);

export default router;
