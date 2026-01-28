import { Request, Response } from 'express';
import { stripeService } from '../services/stripe.service';
import { orderService } from '../services/order.service';

export const paymentController = {
  /**
   * Create a payment intent for an order
   * POST /api/payments/create-intent
   */
  async createPaymentIntent(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { orderId } = req.body;

      if (!orderId) {
        return res.status(400).json({ error: 'orderId is required' });
      }

      // Verify order belongs to user
      const order = await orderService.getOrderById(orderId, req.user.userId);

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      // Create payment intent
      const result = await stripeService.createPaymentIntent(
        orderId,
        order.totalAmount,
        'usd'
      );

      res.json({
        clientSecret: result.clientSecret,
        paymentIntentId: result.paymentIntentId,
      });
    } catch (error: any) {
      console.error('Create payment intent error:', error);
      res.status(400).json({ error: error.message || 'Failed to create payment intent' });
    }
  },

  /**
   * Confirm payment after Stripe checkout
   * POST /api/payments/confirm
   */
  async confirmPayment(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { paymentIntentId } = req.body;

      if (!paymentIntentId) {
        return res.status(400).json({ error: 'paymentIntentId is required' });
      }

      const result = await stripeService.confirmPayment(paymentIntentId);

      if (result.success) {
        res.json({
          success: true,
          message: 'Payment confirmed successfully',
          orderId: result.orderId,
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Payment confirmation failed',
          status: result.status,
        });
      }
    } catch (error: any) {
      console.error('Confirm payment error:', error);
      res.status(400).json({ error: error.message || 'Failed to confirm payment' });
    }
  },

  /**
   * Handle Stripe webhook events
   * POST /api/payments/webhook
   */
  async handleWebhook(req: Request, res: Response) {
    try {
      const sig = req.headers['stripe-signature'];

      if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
        return res.status(400).json({ error: 'Missing stripe signature or webhook secret' });
      }

      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      let event: any;

      try {
        // Use rawBody if available (from middleware), otherwise use body
        const rawBody = (req as any).rawBody || req.body;
        event = stripe.webhooks.constructEvent(
          rawBody,
          sig,
          process.env.STRIPE_WEBHOOK_SECRET
        );
      } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
      }

      // Handle the event
      await stripeService.handleWebhook(event);

      res.json({ received: true });
    } catch (error: any) {
      console.error('Webhook handling error:', error);
      res.status(400).json({ error: error.message || 'Webhook handling failed' });
    }
  },
};
