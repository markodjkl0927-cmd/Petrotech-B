import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ChargingOrderStatus, OrderStatus, PaymentStatus } from '@prisma/client';
import { orderService } from '../services/order.service';
import { notifyUser, notifyDriver } from '../services/notification.service';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const INVITE_JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export const adminController = {
  // Get all orders (admin view)
  async getAllOrders(req: Request, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as OrderStatus | undefined;
      const skip = (page - 1) * limit;

      const where: Record<string, any> = {};
      if (status) {
        where.status = status;
      }

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
            address: true,
            driver: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                vehicleType: true,
                vehicleNumber: true,
              },
            },
            orderItems: {
              include: {
                product: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.order.count({ where }),
      ]);

      res.json({
        orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch orders' });
    }
  },

  // Get order by ID (admin view)
  async getOrderById(req: Request, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      const order = await orderService.getOrderById(id, undefined, true);

      res.json({ order });
    } catch (error: any) {
      res.status(404).json({ error: error.message || 'Order not found' });
    }
  },

  // Update order status
  async updateOrderStatus(req: Request, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      const { status, driverId } = req.body;

      if (!status || !Object.values(OrderStatus).includes(status)) {
        return res.status(400).json({ error: 'Valid status is required' });
      }

      // Validate status transitions
      const order = await prisma.order.findUnique({
        where: { id },
      });

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      // If assigning driver, validate driver exists and is available
      if (driverId) {
        const driver = await prisma.driver.findUnique({
          where: { id: driverId },
        });

        if (!driver) {
          return res.status(404).json({ error: 'Driver not found' });
        }

        if (!driver.isAvailable || !driver.isActive) {
          return res.status(400).json({ error: 'Driver is not available' });
        }
      }

      // Update order
      const updateData: any = {
        status,
      };

      if (driverId) {
        updateData.driverId = driverId;
      }

      // Set deliveredAt when status is DELIVERED
      if (status === OrderStatus.DELIVERED) {
        updateData.deliveredAt = new Date();
      }

      // Update payment status if order is delivered
      if (status === OrderStatus.DELIVERED && order.paymentStatus === PaymentStatus.PENDING) {
        // For COD orders, mark as paid when delivered
        if (order.paymentMethod !== 'ONLINE') {
          updateData.paymentStatus = PaymentStatus.PAID;
        }
      }

      const updatedOrder = await prisma.order.update({
        where: { id },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          address: true,
          driver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              vehicleType: true,
              vehicleNumber: true,
            },
          },
          orderItems: {
            include: {
              product: true,
            },
          },
        },
      });

      // Push: order status change (customer)
      const statusMessages: Record<string, string> = {
        [OrderStatus.CONFIRMED]: 'Your fuel order is confirmed.',
        [OrderStatus.DISPATCHED]: 'Your driver is on the way.',
        [OrderStatus.IN_TRANSIT]: 'Your driver is on the way.',
        [OrderStatus.DELIVERED]: `Your fuel order #${updatedOrder.orderNumber} has been delivered.`,
        [OrderStatus.CANCELLED]: `Order #${updatedOrder.orderNumber} was cancelled.`,
      };
      const msg = statusMessages[status];
      if (msg) {
        notifyUser(updatedOrder.userId, 'Order update', msg, { type: 'order_status', orderId: id, status }).catch(() => {});
      }

      res.json({ order: updatedOrder });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update order status' });
    }
  },

  // Assign driver to order
  async assignDriver(req: Request, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      const { driverId } = req.body;

      if (!driverId) {
        return res.status(400).json({ error: 'driverId is required' });
      }

      const order = await prisma.order.findUnique({
        where: { id },
      });

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const driver = await prisma.driver.findUnique({
        where: { id: driverId },
      });

      if (!driver) {
        return res.status(404).json({ error: 'Driver not found' });
      }

      if (!driver.isAvailable || !driver.isActive) {
        return res.status(400).json({ error: 'Driver is not available' });
      }

      const updatedOrder = await prisma.order.update({
        where: { id },
        data: {
          driverId,
          status: order.status === OrderStatus.PENDING ? OrderStatus.CONFIRMED : order.status,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          address: true,
          driver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              vehicleType: true,
              vehicleNumber: true,
            },
          },
          orderItems: {
            include: {
              product: true,
            },
          },
        },
      });

      // Push: driver assigned
      notifyUser(updatedOrder.userId, 'Driver assigned', `A driver is assigned to your fuel order #${updatedOrder.orderNumber}. Track delivery in the app.`, { type: 'order_assigned', orderId: id }).catch(() => {});
      notifyDriver(driverId, 'New delivery', `You’re assigned to fuel order #${updatedOrder.orderNumber}. Open the app to view details.`, { type: 'order_assigned', orderId: id }).catch(() => {});

      res.json({ order: updatedOrder });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to assign driver' });
    }
  },

  // Get all EV charging orders (admin view)
  async getAllChargingOrders(req: Request, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as ChargingOrderStatus | undefined;
      const skip = (page - 1) * limit;

      const where: Record<string, any> = {};
      if (status && Object.values(ChargingOrderStatus).includes(status)) {
        where.status = status;
      }

      const [orders, total] = await Promise.all([
        prisma.chargingOrder.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
            address: true,
            driver: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                vehicleNumber: true,
              },
            },
            chargingUnit: {
              select: {
                id: true,
                name: true,
                type: true,
                connectorType: true,
                maxPower: true,
              },
            },
            cars: {
              include: {
                car: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.chargingOrder.count({ where }),
      ]);

      res.json({
        orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch charging orders' });
    }
  },

  // Update EV charging order status (admin view)
  async updateChargingOrderStatus(req: Request, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      const { status, driverId } = req.body as { status?: ChargingOrderStatus; driverId?: string };

      if (!status || !Object.values(ChargingOrderStatus).includes(status)) {
        return res.status(400).json({ error: 'Valid status is required' });
      }

      const order = await prisma.chargingOrder.findUnique({ where: { id } });
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      // If assigning driver, validate driver exists and is available
      if (driverId) {
        const driver = await prisma.driver.findUnique({ where: { id: driverId } });
        if (!driver) return res.status(404).json({ error: 'Driver not found' });
        if (!driver.isAvailable || !driver.isActive) {
          return res.status(400).json({ error: 'Driver is not available' });
        }
      }

      const updateData: any = { status };
      if (driverId) updateData.driverId = driverId;

      // Timestamps based on status
      if (status === ChargingOrderStatus.IN_PROGRESS) {
        updateData.startedAt = new Date();
      }
      if (status === ChargingOrderStatus.COMPLETED) {
        updateData.completedAt = new Date();
      }
      if (status === ChargingOrderStatus.CANCELLED) {
        updateData.cancelledAt = new Date();
      }

      // Mark COD payments as PAID when completed
      if (
        status === ChargingOrderStatus.COMPLETED &&
        order.paymentStatus === PaymentStatus.PENDING &&
        order.paymentMethod !== 'ONLINE'
      ) {
        updateData.paymentStatus = PaymentStatus.PAID;
      }

      const updatedOrder = await prisma.chargingOrder.update({
        where: { id },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          address: true,
          driver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              vehicleNumber: true,
            },
          },
          chargingUnit: {
            select: {
              id: true,
              name: true,
              type: true,
              connectorType: true,
              maxPower: true,
            },
          },
          cars: {
            include: {
              car: true,
            },
          },
        },
      });

      // Push: charging order status (customer)
      const statusMessages: Record<string, string> = {
        [ChargingOrderStatus.ASSIGNED]: 'A driver is assigned to your EV charging request.',
        [ChargingOrderStatus.IN_PROGRESS]: 'Your EV charging session has started.',
        [ChargingOrderStatus.COMPLETED]: `Your EV charging order #${updatedOrder.orderNumber} is complete.`,
        [ChargingOrderStatus.CANCELLED]: `Charging order #${updatedOrder.orderNumber} was cancelled.`,
      };
      const msg = statusMessages[status];
      if (msg) {
        notifyUser(updatedOrder.userId, 'Charging update', msg, { type: 'charging_status', orderId: id, status }).catch(() => {});
      }

      res.json({ order: updatedOrder });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update charging order status' });
    }
  },

  // Assign driver to EV charging order (admin view)
  async assignChargingOrderDriver(req: Request, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      const { driverId } = req.body as { driverId?: string };

      if (!driverId) {
        return res.status(400).json({ error: 'driverId is required' });
      }

      const order = await prisma.chargingOrder.findUnique({ where: { id } });
      if (!order) return res.status(404).json({ error: 'Order not found' });

      const driver = await prisma.driver.findUnique({ where: { id: driverId } });
      if (!driver) return res.status(404).json({ error: 'Driver not found' });
      if (!driver.isAvailable || !driver.isActive) {
        return res.status(400).json({ error: 'Driver is not available' });
      }

      const updatedOrder = await prisma.chargingOrder.update({
        where: { id },
        data: {
          driverId,
          status: order.status === ChargingOrderStatus.PENDING ? ChargingOrderStatus.ASSIGNED : order.status,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          address: true,
          driver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              vehicleNumber: true,
            },
          },
          cars: {
            include: {
              car: true,
            },
          },
        },
      });

      // Push: EV driver assigned
      notifyUser(updatedOrder.userId, 'Driver assigned', `A driver is assigned to your EV charging order #${updatedOrder.orderNumber}.`, { type: 'charging_assigned', orderId: id }).catch(() => {});
      notifyDriver(driverId, 'New EV charging job', `You’re assigned to EV order #${updatedOrder.orderNumber}. Open the app to view details.`, { type: 'charging_assigned', orderId: id }).catch(() => {});

      res.json({ order: updatedOrder });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to assign driver' });
    }
  },

  // Get all drivers
  async getAllDrivers(req: Request, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const drivers = await prisma.driver.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
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

      res.json({ drivers });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch drivers' });
    }
  },

  // Get driver by ID (for admin edit)
  async getDriverById(req: Request, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      const { id } = req.params;
      const driver = await prisma.driver.findUnique({
        where: { id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
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
      if (!driver) {
        return res.status(404).json({ error: 'Driver not found' });
      }
      res.json({ driver });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch driver' });
    }
  },

  // Get available drivers
  async getAvailableDrivers(req: Request, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const drivers = await prisma.driver.findMany({
        where: {
          isAvailable: true,
          isActive: true,
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          photoUrl: true,
          vehicleType: true,
          vehicleNumber: true,
          isAvailable: true,
          isActive: true,
        },
      });

      res.json({ drivers });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch available drivers' });
    }
  },

  // Create driver
  async createDriver(req: Request, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { firstName, lastName, email, phone, licenseNumber, vehicleType, vehicleNumber, password, photoUrl } = req.body;

      if (!firstName || !lastName || !email || !phone || !licenseNumber || !vehicleType || !vehicleNumber) {
        return res.status(400).json({
          error: 'All fields are required: firstName, lastName, email, phone, licenseNumber, vehicleType, vehicleNumber',
        });
      }

      // Check if driver with email already exists
      const existing = await prisma.driver.findUnique({
        where: { email },
      });

      if (existing) {
        return res.status(400).json({ error: 'Driver with this email already exists' });
      }

      const driver = await prisma.driver.create({
        data: {
          firstName,
          lastName,
          email: String(email).toLowerCase(),
          phone,
          photoUrl,
          licenseNumber,
          vehicleType,
          vehicleNumber,
          isAvailable: true,
          isActive: true,
          password: password ? await bcrypt.hash(String(password), 10) : undefined,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
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

      res.status(201).json({ driver });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to create driver' });
    }
  },

  // Update driver
  async updateDriver(req: Request, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      const { firstName, lastName, email, phone, photoUrl, licenseNumber, vehicleType, vehicleNumber, isAvailable, isActive, password } =
        req.body;

      const updateData: any = {
        firstName,
        lastName,
        email: email ? String(email).toLowerCase() : undefined,
        phone,
        photoUrl,
        licenseNumber,
        vehicleType,
        vehicleNumber,
        isAvailable,
        isActive,
      };

      if (password) {
        updateData.password = await bcrypt.hash(String(password), 10);
      }

      const driver = await prisma.driver.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
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

      res.json({ driver });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update driver' });
    }
  },

  // Generate one-time invite token for driver activation (admin)
  async createDriverInvite(req: Request, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      const ttlHoursRaw = (req.body?.ttlHours ?? req.query?.ttlHours) as string | number | undefined;
      const ttlHours = Number(ttlHoursRaw || 24 * 7); // default: 7 days
      const safeTtlHours = Number.isFinite(ttlHours) && ttlHours > 0 ? Math.min(ttlHours, 24 * 30) : 24 * 7; // cap at 30 days

      const driver = await prisma.driver.findUnique({
        where: { id },
        select: { id: true, email: true, firstName: true, lastName: true, isActive: true },
      });

      if (!driver) return res.status(404).json({ error: 'Driver not found' });
      if (!driver.isActive) return res.status(400).json({ error: 'Driver account is deactivated' });

      const expiresAt = new Date(Date.now() + safeTtlHours * 60 * 60 * 1000);

      // MVP: use a signed, time-limited token (no DB columns required).
      // This avoids failures if migrations haven't been applied yet.
      const token = jwt.sign(
        { driverId: driver.id, purpose: 'DRIVER_INVITE' },
        INVITE_JWT_SECRET,
        { expiresIn: safeTtlHours * 60 * 60 } as any
      );

      res.json({
        token,
        expiresAt,
        driver: {
          id: driver.id,
          email: driver.email,
          firstName: driver.firstName,
          lastName: driver.lastName,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to create driver invite' });
    }
  },

  // Delete driver
  async deleteDriver(req: Request, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;

      // Check if driver exists
      const driver = await prisma.driver.findUnique({
        where: { id },
        include: {
          orders: {
            where: {
              status: {
                in: ['PENDING', 'CONFIRMED', 'DISPATCHED', 'IN_TRANSIT'],
              },
            },
          },
        },
      });

      if (!driver) {
        return res.status(404).json({ error: 'Driver not found' });
      }

      // Check if driver has active orders
      if (driver.orders.length > 0) {
        return res.status(400).json({ error: 'Cannot delete driver with active orders' });
      }

      // Delete the driver
      await prisma.driver.delete({
        where: { id },
      });

      res.json({ message: 'Driver deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to delete driver' });
    }
  },

  // Get customer by ID (for order detail when user not embedded)
  async getCustomerById(req: Request, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      const { id } = req.params;
      const customer = await prisma.user.findFirst({
        where: { id, role: 'CUSTOMER' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      });
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      res.json({ customer });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch customer' });
    }
  },

  // Get all customers
  async getAllCustomers(req: Request, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const [customers, total] = await Promise.all([
        prisma.user.findMany({
          where: { role: 'CUSTOMER' },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            isActive: true,
            createdAt: true,
            _count: {
              select: {
                orders: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.user.count({
          where: { role: 'CUSTOMER' },
        }),
      ]);

      res.json({
        customers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch customers' });
    }
  },

  // Update customer
  async updateCustomer(req: Request, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      const { firstName, lastName, email, phone, isActive } = req.body;

      // Check if customer exists
      const existingCustomer = await prisma.user.findUnique({
        where: { id },
      });

      if (!existingCustomer || existingCustomer.role !== 'CUSTOMER') {
        return res.status(404).json({ error: 'Customer not found' });
      }

      // If email is being changed, check if new email is already taken
      if (email && email !== existingCustomer.email) {
        const emailExists = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });
        if (emailExists) {
          return res.status(400).json({ error: 'Email already in use' });
        }
      }

      const customer = await prisma.user.update({
        where: { id },
        data: {
          firstName,
          lastName,
          email: email ? email.toLowerCase() : undefined,
          phone,
          isActive,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          isActive: true,
          createdAt: true,
        },
      });

      res.json({ customer });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update customer' });
    }
  },

  // Delete customer
  async deleteCustomer(req: Request, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;

      // Check if customer exists
      const customer = await prisma.user.findUnique({
        where: { id },
        include: {
          orders: {
            where: {
              status: {
                in: ['PENDING', 'CONFIRMED', 'DISPATCHED', 'IN_TRANSIT'],
              },
            },
          },
        },
      });

      if (!customer || customer.role !== 'CUSTOMER') {
        return res.status(404).json({ error: 'Customer not found' });
      }

      // Check if customer has active orders
      if (customer.orders.length > 0) {
        return res.status(400).json({ error: 'Cannot delete customer with active orders' });
      }

      // Delete the customer (cascade will handle addresses)
      await prisma.user.delete({
        where: { id },
      });

      res.json({ message: 'Customer deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to delete customer' });
    }
  },

  // Get dashboard stats
  async getDashboardStats(req: Request, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const [
        totalOrders,
        pendingOrders,
        confirmedOrders,
        dispatchedOrders,
        deliveredOrders,
        totalCustomers,
        totalDrivers,
        totalRevenue,
      ] = await Promise.all([
        prisma.order.count(),
        prisma.order.count({ where: { status: OrderStatus.PENDING } }),
        prisma.order.count({ where: { status: OrderStatus.CONFIRMED } }),
        prisma.order.count({ where: { status: OrderStatus.DISPATCHED } }),
        prisma.order.count({ where: { status: OrderStatus.DELIVERED } }),
        prisma.user.count({ where: { role: 'CUSTOMER' } }),
        prisma.driver.count({ where: { isActive: true } }),
        prisma.order.aggregate({
          where: { paymentStatus: PaymentStatus.PAID },
          _sum: { totalAmount: true },
        }),
      ]);

      res.json({
        stats: {
          totalOrders,
          pendingOrders,
          confirmedOrders,
          dispatchedOrders,
          deliveredOrders,
          totalCustomers,
          totalDrivers,
          totalRevenue: totalRevenue._sum.totalAmount || 0,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch dashboard stats' });
    }
  },
};
