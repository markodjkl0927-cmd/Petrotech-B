import Stripe from 'stripe';
import { prisma } from '../lib/prisma';
import { PaymentStatus } from '@prisma/client';

type PaymentOrderType = 'fuel' | 'charging';

function normalizeOrderType(value: unknown): PaymentOrderType {
  return value === 'charging' ? 'charging' : 'fuel';
}

// Initialize Stripe only if secret key is provided
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-12-15.clover',
  });
} else {
  console.warn('⚠️  STRIPE_SECRET_KEY is not set. Payment features will be disabled.');
}

export const stripeService = {
  /**
   * Create a payment intent for an order
   */
  async createPaymentIntent(
    orderId: string,
    amount: number,
    currency: string = 'usd',
    orderType: PaymentOrderType = 'fuel'
  ) {
    if (!stripe) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }
    
    try {
      // Verify order exists and is pending payment
      const normalizedType = normalizeOrderType(orderType);
      const order =
        normalizedType === 'charging'
          ? await prisma.chargingOrder.findUnique({
              where: { id: orderId },
              include: { user: true },
            })
          : await prisma.order.findUnique({
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
          orderType: normalizedType,
        },
        description:
          normalizedType === 'charging'
            ? `Petrotech EV Charging ${order.orderNumber}`
            : `Petrotech Order ${order.orderNumber}`,
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
    if (!stripe) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }
    
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (!paymentIntent.metadata.orderId) {
        throw new Error('Order ID not found in payment intent metadata');
      }

      const orderId = paymentIntent.metadata.orderId;
      const orderType = normalizeOrderType(paymentIntent.metadata.orderType);

      // Update order payment status
      if (paymentIntent.status === 'succeeded') {
        if (orderType === 'charging') {
          await prisma.chargingOrder.update({
            where: { id: orderId },
            data: { paymentStatus: PaymentStatus.PAID },
          });
        } else {
          await prisma.order.update({
            where: { id: orderId },
            data: { paymentStatus: PaymentStatus.PAID },
          });
        }

        return {
          success: true,
          orderId,
          paymentIntentId,
        };
      } else {
        // Payment failed or requires action
        if (orderType === 'charging') {
          await prisma.chargingOrder.update({
            where: { id: orderId },
            data: { paymentStatus: PaymentStatus.FAILED },
          });
        } else {
          await prisma.order.update({
            where: { id: orderId },
            data: { paymentStatus: PaymentStatus.FAILED },
          });
        }

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
    if (!stripe) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }
    
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          if (paymentIntent.metadata.orderId) {
            const orderType = normalizeOrderType(paymentIntent.metadata.orderType);
            if (orderType === 'charging') {
              await prisma.chargingOrder.update({
                where: { id: paymentIntent.metadata.orderId },
                data: { paymentStatus: PaymentStatus.PAID },
              });
            } else {
              await prisma.order.update({
                where: { id: paymentIntent.metadata.orderId },
                data: { paymentStatus: PaymentStatus.PAID },
              });
            }
          }
          break;

        case 'payment_intent.payment_failed':
          const failedPayment = event.data.object as Stripe.PaymentIntent;
          if (failedPayment.metadata.orderId) {
            const orderType = normalizeOrderType(failedPayment.metadata.orderType);
            if (orderType === 'charging') {
              await prisma.chargingOrder.update({
                where: { id: failedPayment.metadata.orderId },
                data: { paymentStatus: PaymentStatus.FAILED },
              });
            } else {
              await prisma.order.update({
                where: { id: failedPayment.metadata.orderId },
                data: { paymentStatus: PaymentStatus.FAILED },
              });
            }
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
    if (!stripe) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
    }
    
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
          const orderType = normalizeOrderType(paymentIntent.metadata.orderType);
          const order =
            orderType === 'charging'
              ? await prisma.chargingOrder.findUnique({
                  where: { id: paymentIntent.metadata.orderId },
                })
              : await prisma.order.findUnique({
                  where: { id: paymentIntent.metadata.orderId },
                });

          if (order) {
            const isFullRefund = !amount || amount >= order.totalAmount;
            if (orderType === 'charging') {
              await prisma.chargingOrder.update({
                where: { id: paymentIntent.metadata.orderId },
                data: {
                  paymentStatus: isFullRefund ? PaymentStatus.REFUNDED : PaymentStatus.PAID,
                },
              });
            } else {
              await prisma.order.update({
                where: { id: paymentIntent.metadata.orderId },
                data: {
                  paymentStatus: isFullRefund ? PaymentStatus.REFUNDED : PaymentStatus.PAID,
                },
              });
            }
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
