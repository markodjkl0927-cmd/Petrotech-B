import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ChargingOrderStatus, OrderStatus, PaymentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

export const driverController = {
  async getMe(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const driverId = req.user.userId;

      const driver = await prisma.driver.findUnique({
        where: { id: driverId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          photoUrl: true,
          licenseNumber: true,
          vehicleType: true,
          vehicleNumber: true,
          isAvailable: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!driver) return res.status(404).json({ error: 'Driver not found' });
      res.json({ driver });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch driver profile' });
    }
  },

  async updateMe(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const driverId = req.user.userId;

      const {
        firstName,
        lastName,
        phone,
        photoUrl,
        licenseNumber,
        vehicleType,
        vehicleNumber,
        isAvailable,
        password,
      } = req.body;

      const updateData: any = {
        firstName,
        lastName,
        phone,
        photoUrl,
        licenseNumber,
        vehicleType,
        vehicleNumber,
        isAvailable,
      };

      if (typeof password === 'string' && password.length > 0) {
        if (password.length < 6) {
          return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }
        updateData.password = await bcrypt.hash(password, 10);
      }

      const driver = await prisma.driver.update({
        where: { id: driverId },
        data: updateData,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          photoUrl: true,
          licenseNumber: true,
          vehicleType: true,
          vehicleNumber: true,
          isAvailable: true,
          isActive: true,
          updatedAt: true,
        },
      });

      res.json({ driver });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update driver profile' });
    }
  },

  async uploadPhoto(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const driverId = req.user.userId;

      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) return res.status(400).json({ error: 'Photo file is required (field name: photo)' });

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const photoUrl = `${baseUrl}/uploads/drivers/${file.filename}`;

      const driver = await prisma.driver.update({
        where: { id: driverId },
        data: { photoUrl },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          photoUrl: true,
          licenseNumber: true,
          vehicleType: true,
          vehicleNumber: true,
          isAvailable: true,
          isActive: true,
          updatedAt: true,
        },
      });

      res.json({ driver, photoUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to upload driver photo' });
    }
  },

  async getAssignedFuelOrders(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const driverId = req.user.userId;

      const orders = await prisma.order.findMany({
        where: { driverId },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          address: true,
          orderItems: { include: { product: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ orders });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch assigned orders' });
    }
  },

  async getFuelOrderById(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const driverId = req.user.userId;
      const { id } = req.params;

      const order = await prisma.order.findFirst({
        where: { id, driverId },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          address: true,
          orderItems: { include: { product: true } },
        },
      });

      if (!order) return res.status(404).json({ error: 'Order not found' });
      res.json({ order });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch order' });
    }
  },

  async updateFuelOrderStatus(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const driverId = req.user.userId;
      const { id } = req.params;
      const { status } = req.body as { status?: OrderStatus };

      if (!status || !Object.values(OrderStatus).includes(status)) {
        return res.status(400).json({ error: 'Valid status is required' });
      }

      const existing = await prisma.order.findFirst({ where: { id, driverId } });
      if (!existing) return res.status(404).json({ error: 'Order not found' });

      const updateData: any = { status };
      if (status === OrderStatus.DELIVERED) {
        updateData.deliveredAt = new Date();
        if (existing.paymentStatus === PaymentStatus.PENDING && existing.paymentMethod !== 'ONLINE') {
          updateData.paymentStatus = PaymentStatus.PAID;
        }
      }
      if (status === OrderStatus.CANCELLED) {
        updateData.cancelledAt = new Date();
      }

      const order = await prisma.order.update({
        where: { id },
        data: updateData,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          address: true,
          orderItems: { include: { product: true } },
        },
      });

      res.json({ order });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update order status' });
    }
  },

  async getAssignedChargingOrders(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const driverId = req.user.userId;

      const orders = await prisma.chargingOrder.findMany({
        where: { driverId },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          address: true,
          cars: { include: { car: true } },
          chargingUnit: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ orders });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch assigned charging orders' });
    }
  },

  async getChargingOrderById(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const driverId = req.user.userId;
      const { id } = req.params;

      const order = await prisma.chargingOrder.findFirst({
        where: { id, driverId },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          address: true,
          cars: { include: { car: true } },
          chargingUnit: true,
        },
      });

      if (!order) return res.status(404).json({ error: 'Order not found' });
      res.json({ order });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch charging order' });
    }
  },

  async updateChargingOrderStatus(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const driverId = req.user.userId;
      const { id } = req.params;
      const { status } = req.body as { status?: ChargingOrderStatus };

      if (!status || !Object.values(ChargingOrderStatus).includes(status)) {
        return res.status(400).json({ error: 'Valid status is required' });
      }

      const existing = await prisma.chargingOrder.findFirst({ where: { id, driverId } });
      if (!existing) return res.status(404).json({ error: 'Order not found' });

      const updateData: any = { status };
      if (status === ChargingOrderStatus.IN_PROGRESS) {
        updateData.startedAt = new Date();
      }
      if (status === ChargingOrderStatus.COMPLETED) {
        updateData.completedAt = new Date();
        if (existing.paymentStatus === PaymentStatus.PENDING && existing.paymentMethod !== 'ONLINE') {
          updateData.paymentStatus = PaymentStatus.PAID;
        }
      }
      if (status === ChargingOrderStatus.CANCELLED) {
        updateData.cancelledAt = new Date();
      }

      const order = await prisma.chargingOrder.update({
        where: { id },
        data: updateData,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          address: true,
          cars: { include: { car: true } },
          chargingUnit: true,
        },
      });

      res.json({ order });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update charging order status' });
    }
  },
};

