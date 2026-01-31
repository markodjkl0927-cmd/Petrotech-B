import { Request, Response } from 'express';
import { chargingService } from '../services/charging.service';
import { ChargingDuration, PaymentMethod } from '@prisma/client';
import { prisma } from '../lib/prisma';

export const chargingController = {
  /**
   * Create a new charging order
   */
  async create(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const {
        addressId,
        chargingDuration,
        numberOfCars,
        carIds,
        paymentMethod,
        scheduledAt,
        notes,
        tip,
      } = req.body;

      // Validation
      if (!addressId || !chargingDuration || !numberOfCars || !carIds || !paymentMethod) {
        return res.status(400).json({
          error: 'Missing required fields: addressId, chargingDuration, numberOfCars, carIds, paymentMethod',
        });
      }

      if (!Object.values(ChargingDuration).includes(chargingDuration)) {
        return res.status(400).json({ error: 'Invalid charging duration' });
      }

      if (!Object.values(PaymentMethod).includes(paymentMethod)) {
        return res.status(400).json({ error: 'Invalid payment method' });
      }

      if (numberOfCars < 1 || numberOfCars > 10) {
        return res.status(400).json({ error: 'Number of cars must be between 1 and 10' });
      }

      if (!Array.isArray(carIds) || carIds.length !== numberOfCars) {
        return res.status(400).json({ error: 'carIds must be an array matching numberOfCars' });
      }

      const order = await chargingService.createOrder({
        userId,
        addressId,
        chargingDuration,
        numberOfCars,
        carIds,
        paymentMethod,
        scheduledAt,
        notes,
        tip: tip ? parseFloat(tip) : 0,
      });

      res.status(201).json(order);
    } catch (error: any) {
      console.error('Error creating charging order:', error);
      res.status(400).json({ error: error.message || 'Failed to create charging order' });
    }
  },

  /**
   * Get all orders for the current user
   */
  async getOrders(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      const isAdmin = req.user?.role === 'ADMIN';

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const orders = await chargingService.getUserOrders(userId, isAdmin);
      res.json(orders);
    } catch (error: any) {
      console.error('Error fetching charging orders:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch orders' });
    }
  },

  /**
   * Get order by ID
   */
  async getOrderById(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      const isAdmin = req.user?.role === 'ADMIN';

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      const order = await chargingService.getOrderById(id, userId, isAdmin);

      res.json(order);
    } catch (error: any) {
      console.error('Error fetching charging order:', error);
      res.status(404).json({ error: error.message || 'Order not found' });
    }
  },

  /**
   * Live tracking (customer/admin/driver)
   */
  async getTracking(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      const role = req.user?.role;

      if (!userId || !role) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;

      const order = await prisma.chargingOrder.findUnique({
        where: { id },
        select: {
          id: true,
          orderNumber: true,
          userId: true,
          driverId: true,
          status: true,
          startedAt: true,
          completedAt: true,
          cancelledAt: true,
          driver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              vehicleNumber: true,
              photoUrl: true,
            },
          },
        },
      });

      if (!order) return res.status(404).json({ error: 'Order not found' });

      if (role === 'CUSTOMER' && order.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (role === 'DRIVER' && order.driverId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const location = order.driverId
        ? await prisma.driverLocation.findUnique({
            where: { driverId: order.driverId },
            select: {
              latitude: true,
              longitude: true,
              accuracy: true,
              heading: true,
              speed: true,
              updatedAt: true,
            },
          })
        : null;

      res.json({
        tracking: {
          orderType: 'EV',
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          startedAt: order.startedAt,
          completedAt: order.completedAt,
          cancelledAt: order.cancelledAt,
          driver: order.driverId ? order.driver : null,
          location,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch tracking' });
    }
  },

  /**
   * Update order status (admin/driver only)
   */
  async updateStatus(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      const isAdmin = req.user?.role === 'ADMIN';
      const isDriver = req.user?.role === 'DRIVER';

      if (!userId || (!isAdmin && !isDriver)) {
        return res.status(403).json({ error: 'Forbidden: Admin or Driver access required' });
      }

      const { id } = req.params;
      const { status, driverId, chargingUnitId } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }

      const order = await chargingService.updateOrderStatus(id, status, driverId, chargingUnitId);
      res.json(order);
    } catch (error: any) {
      console.error('Error updating charging order status:', error);
      res.status(400).json({ error: error.message || 'Failed to update order status' });
    }
  },

  /**
   * Cancel order
   */
  async cancel(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      const isAdmin = req.user?.role === 'ADMIN';

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      const { reason } = req.body;

      const order = await chargingService.cancelOrder(id, userId, reason, isAdmin);
      res.json(order);
    } catch (error: any) {
      console.error('Error cancelling charging order:', error);
      res.status(400).json({ error: error.message || 'Failed to cancel order' });
    }
  },

  /**
   * Get pricing for a charging duration
   */
  async getPricing(req: Request, res: Response) {
    try {
      const { duration } = req.query;

      if (!duration || !Object.values(ChargingDuration).includes(duration as ChargingDuration)) {
        return res.status(400).json({ error: 'Valid duration is required' });
      }

      const price = chargingService.getPricing(duration as ChargingDuration);
      res.json({ duration, price });
    } catch (error: any) {
      console.error('Error fetching pricing:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch pricing' });
    }
  },

  /**
   * Get all pricing options
   */
  async getAllPricing(req: Request, res: Response) {
    try {
      const pricing = {
        ONE_HOUR: chargingService.getPricing(ChargingDuration.ONE_HOUR),
        TWO_HOURS: chargingService.getPricing(ChargingDuration.TWO_HOURS),
        FIVE_HOURS: chargingService.getPricing(ChargingDuration.FIVE_HOURS),
        TWENTY_FOUR_HOURS: chargingService.getPricing(ChargingDuration.TWENTY_FOUR_HOURS),
      };

      res.json(pricing);
    } catch (error: any) {
      console.error('Error fetching pricing:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch pricing' });
    }
  },
};
