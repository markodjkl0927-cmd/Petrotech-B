import Stripe from 'stripe';
import { prisma } from '../lib/prisma';
import { PaymentStatus } from '@prisma/client';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

export const stripeService = {
  /**
   * Create a payment intent for an order
   */
  async createPaymentIntent(orderId: string, amount: number, currency: string = 'usd') {
    try {
      // Verify order exists and is pending payment
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { user: true },
      });

      if (!order) {
        throw new Error('Order not found');
      }

      if (order.paymentStatus !== PaymentStatus.PENDING) {
        throw new Error('Order payment status is not pending');
      }

      // Convert amount to cents (Stripe uses smallest currency unit)
      const amountInCents = Math.round(amount * 100);

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: currency.toLowerCase(),
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          userId: order.userId,
        },
        description: `Petrotech Order ${order.orderNumber}`,
      });

      // Store payment intent ID in order (you might want to add a paymentIntentId field to Order model)
      // For now, we'll use the order notes or create a separate payment record
      // This is a simplified approach - in production, you'd want a Payment table

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error: any) {
      console.error('Stripe payment intent creation error:', error);
      throw new Error(error.message || 'Failed to create payment intent');
    }
  },

  /**
   * Confirm payment and update order status
   */
  async confirmPayment(paymentIntentId: string) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (!paymentIntent.metadata.orderId) {
        throw new Error('Order ID not found in payment intent metadata');
      }

      const orderId = paymentIntent.metadata.orderId;

      // Update order payment status
      if (paymentIntent.status === 'succeeded') {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: PaymentStatus.PAID,
          },
        });

        return {
          success: true,
          orderId,
          paymentIntentId,
        };
      } else {
        // Payment failed or requires action
        await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: PaymentStatus.FAILED,
          },
        });

        return {
          success: false,
          orderId,
          paymentIntentId,
          status: paymentIntent.status,
        };
      }
    } catch (error: any) {
      console.error('Stripe payment confirmation error:', error);
      throw new Error(error.message || 'Failed to confirm payment');
    }
  },

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(event: Stripe.Event) {
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          if (paymentIntent.metadata.orderId) {
            await prisma.order.update({
              where: { id: paymentIntent.metadata.orderId },
              data: {
                paymentStatus: PaymentStatus.PAID,
              },
            });
          }
          break;

        case 'payment_intent.payment_failed':
          const failedPayment = event.data.object as Stripe.PaymentIntent;
          if (failedPayment.metadata.orderId) {
            await prisma.order.update({
              where: { id: failedPayment.metadata.orderId },
              data: {
                paymentStatus: PaymentStatus.FAILED,
              },
            });
          }
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return { received: true };
    } catch (error: any) {
      console.error('Webhook handling error:', error);
      throw new Error(error.message || 'Failed to handle webhook');
    }
  },

  /**
   * Create a refund for an order
   */
  async createRefund(paymentIntentId: string, amount?: number) {
    try {
      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId,
      };

      if (amount) {
        // Convert to cents
        refundParams.amount = Math.round(amount * 100);
      }

      const refund = await stripe.refunds.create(refundParams);

      // Update order payment status if full refund
      if (refund.status === 'succeeded') {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.metadata.orderId) {
          const order = await prisma.order.findUnique({
            where: { id: paymentIntent.metadata.orderId },
          });

          if (order) {
            const isFullRefund = !amount || amount >= order.totalAmount;
            await prisma.order.update({
              where: { id: paymentIntent.metadata.orderId },
              data: {
                paymentStatus: isFullRefund ? PaymentStatus.REFUNDED : PaymentStatus.PAID,
              },
            });
          }
        }
      }

      return refund;
    } catch (error: any) {
      console.error('Stripe refund error:', error);
      throw new Error(error.message || 'Failed to create refund');
    }
  },
};
