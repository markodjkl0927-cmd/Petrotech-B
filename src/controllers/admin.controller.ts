import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { orderService } from '../services/order.service';

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
        },
      });

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
      });

      res.json({ drivers });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch drivers' });
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

      const { firstName, lastName, email, phone, licenseNumber, vehicleType, vehicleNumber } = req.body;

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
          email,
          phone,
          licenseNumber,
          vehicleType,
          vehicleNumber,
          isAvailable: true,
          isActive: true,
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
      const { firstName, lastName, email, phone, licenseNumber, vehicleType, vehicleNumber, isAvailable, isActive } =
        req.body;

      const driver = await prisma.driver.update({
        where: { id },
        data: {
          firstName,
          lastName,
          email,
          phone,
          licenseNumber,
          vehicleType,
          vehicleNumber,
          isAvailable,
          isActive,
        },
      });

      res.json({ driver });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update driver' });
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
