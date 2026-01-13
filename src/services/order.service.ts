import { prisma } from '../lib/prisma';
import { OrderStatus, PaymentStatus, PaymentMethod, DeliveryType } from '@prisma/client';

export interface CreateOrderDto {
  userId: string;
  addressId: string;
  deliveryType: DeliveryType;
  paymentMethod: PaymentMethod;
  deliveryDate?: Date;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  notes?: string;
}

export const orderService = {
  async createOrder(data: CreateOrderDto) {
    const { userId, addressId, deliveryType, paymentMethod, deliveryDate, items, notes } = data;

    // Verify address belongs to user
    const address = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new Error('Address not found or does not belong to user');
    }

    // Validate products and calculate total
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        throw new Error(`Product with id ${item.productId} not found`);
      }

      if (!product.isAvailable) {
        throw new Error(`Product ${product.name} is not available`);
      }

      if (item.quantity < 50) {
        throw new Error('Minimum order quantity is 50 liters');
      }

      if (item.quantity > 5000) {
        throw new Error('Maximum order quantity is 5000 liters');
      }

      const subtotal = item.quantity * product.pricePerLiter;
      totalAmount += subtotal;

      orderItems.push({
        productId: product.id,
        quantity: item.quantity,
        price: product.pricePerLiter,
        subtotal,
      });
    }

    // Generate order number
    const orderNumber = `PT-${Date.now()}-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;

    // Create order
    const order = await prisma.order.create({
      data: {
        userId,
        addressId,
        orderNumber,
        deliveryType,
        paymentMethod,
        paymentStatus: paymentMethod === PaymentMethod.ONLINE ? PaymentStatus.PAID : PaymentStatus.PENDING,
        status: OrderStatus.PENDING,
        totalAmount,
        deliveryDate,
        notes,
        orderItems: {
          create: orderItems,
        },
      },
      include: {
        address: true,
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    });

    return order;
  },

  async getUserOrders(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId },
        include: {
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
      prisma.order.count({
        where: { userId },
      }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getOrderById(orderId: string, userId?: string, isAdmin: boolean = false) {
    const where: any = { id: orderId };

    if (!isAdmin) {
      where.userId = userId;
    }

    const order = await prisma.order.findFirst({
      where,
      include: {
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

    if (!order) {
      throw new Error('Order not found');
    }

    return order;
  },

  async cancelOrder(orderId: string, userId: string, reason?: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status === OrderStatus.DELIVERED) {
      throw new Error('Cannot cancel a delivered order');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new Error('Order is already cancelled');
    }

    if (order.status === OrderStatus.DISPATCHED || order.status === OrderStatus.IN_TRANSIT) {
      throw new Error('Cannot cancel order that is already dispatched');
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
      include: {
        address: true,
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    });

    return updatedOrder;
  },
};

