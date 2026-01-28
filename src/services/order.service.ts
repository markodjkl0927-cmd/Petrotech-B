import { prisma } from '../lib/prisma';
import { OrderStatus, PaymentStatus, PaymentMethod, DeliveryType } from '@prisma/client';
import {
  calculateDistance,
  COMPANY_LOCATION,
  calculateDeliveryFee,
  calculateCompanyMarkup,
  calculateTax,
} from '../lib/distance';

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
  tip?: number; // Optional tip for driver
}

export const orderService = {
  async createOrder(data: CreateOrderDto) {
    const { userId, addressId, deliveryType, paymentMethod, deliveryDate, items, notes, tip = 0 } = data;

    // Verify address belongs to user
    const address = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new Error('Address not found or does not belong to user');
    }

    // Check if address has coordinates
    if (!address.latitude || !address.longitude) {
      throw new Error('Address must have valid coordinates for distance calculation');
    }

    // Calculate distance from company to delivery address
    const distance = calculateDistance(
      COMPANY_LOCATION.latitude,
      COMPANY_LOCATION.longitude,
      address.latitude,
      address.longitude
    );

    // Validate products and calculate fuel cost (with hidden 0.095% markup included)
    let fuelCost = 0;
    let baseFuelCost = 0; // Base cost without markup (for company records)
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

      // Base price per liter (what goes to gas company)
      const basePricePerLiter = product.pricePerLiter;
      // Price per liter with hidden 0.095% markup (what customer pays)
      const priceWithMarkup = basePricePerLiter * 1.00095;
      
      const baseSubtotal = item.quantity * basePricePerLiter;
      const subtotalWithMarkup = item.quantity * priceWithMarkup;
      
      baseFuelCost += baseSubtotal;
      fuelCost += subtotalWithMarkup; // Fuel cost includes hidden markup

      orderItems.push({
        productId: product.id,
        quantity: item.quantity,
        price: priceWithMarkup, // Store price with markup
        subtotal: subtotalWithMarkup, // Store subtotal with markup
      });
    }

    // Calculate company markup (0.095% of base fuel cost) - for company records only
    const companyMarkup = calculateCompanyMarkup(baseFuelCost);
    
    // Calculate pricing breakdown
    const deliveryFee = calculateDeliveryFee(distance);
    const subtotalForTax = fuelCost + deliveryFee; // Tax on fuel cost (with markup) + delivery
    const tax = calculateTax(subtotalForTax, address.state || undefined);
    const totalAmount = fuelCost + deliveryFee + tax + tip;

    // Generate order number
    const orderNumber = `PT-${Date.now()}-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;

    // Create order
    // For ONLINE payments, set status to PENDING until Stripe payment is confirmed
    const order = await prisma.order.create({
      data: {
        userId,
        addressId,
        orderNumber,
        deliveryType,
        paymentMethod,
        paymentStatus: PaymentStatus.PENDING, // Always start as PENDING, will be updated after payment confirmation
        status: OrderStatus.PENDING,
        totalAmount: Math.round(totalAmount * 100) / 100, // Round to 2 decimal places
        fuelCost: Math.round(fuelCost * 100) / 100, // Includes hidden 0.095% markup
        companyMarkup: Math.round(companyMarkup * 100) / 100, // For company records (hidden from customer)
        distance: Math.round(distance * 100) / 100,
        deliveryFee: Math.round(deliveryFee * 100) / 100,
        tax: Math.round(tax * 100) / 100,
        tip: Math.round(tip * 100) / 100,
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

