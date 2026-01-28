import { Request, Response } from 'express';
import { orderService } from '../services/order.service';
import { DeliveryType, PaymentMethod } from '@prisma/client';

export const orderController = {
  async create(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { addressId, deliveryType, paymentMethod, deliveryDate, items, notes, tip } = req.body;

      if (!addressId || !deliveryType || !paymentMethod || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          error: 'addressId, deliveryType, paymentMethod, and items are required',
        });
      }

      // Validate delivery type
      if (!Object.values(DeliveryType).includes(deliveryType)) {
        return res.status(400).json({ error: 'Invalid delivery type' });
      }

      // Validate payment method
      if (!Object.values(PaymentMethod).includes(paymentMethod)) {
        return res.status(400).json({ error: 'Invalid payment method' });
      }

      // Validate tip (optional, must be non-negative if provided)
      const tipAmount = tip ? parseFloat(tip) : 0;
      if (tipAmount < 0) {
        return res.status(400).json({ error: 'Tip must be a non-negative number' });
      }

      const order = await orderService.createOrder({
        userId: req.user.userId,
        addressId,
        deliveryType,
        paymentMethod,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
        items,
        notes,
        tip: tipAmount,
      });

      res.status(201).json({ order });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to create order' });
    }
  },

  async getAll(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await orderService.getUserOrders(req.user.userId, page, limit);

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch orders' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;

      const order = await orderService.getOrderById(id, req.user.userId);

      res.json({ order });
    } catch (error: any) {
      res.status(404).json({ error: error.message || 'Order not found' });
    }
  },

  async cancel(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      const { reason } = req.body;

      const order = await orderService.cancelOrder(id, req.user.userId, reason);

      res.json({ order });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to cancel order' });
    }
  },
};

