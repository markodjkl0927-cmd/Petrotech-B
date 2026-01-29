import { prisma } from '../lib/prisma';
import { ChargingOrderStatus, PaymentStatus, PaymentMethod, ChargingDuration } from '@prisma/client';
import {
  calculateDistance,
  COMPANY_LOCATION,
  calculateDeliveryFee,
  calculateTax,
} from '../lib/distance';

export interface CreateChargingOrderDto {
  userId: string;
  addressId: string;
  chargingDuration: ChargingDuration;
  numberOfCars: number;
  carIds: string[]; // Array of car IDs to charge
  paymentMethod: PaymentMethod;
  scheduledAt?: Date;
  notes?: string;
  tip?: number;
}

/**
 * Pricing for EV charging (time-based)
 * These prices are per car
 */
const CHARGING_PRICING: Record<ChargingDuration, number> = {
  ONE_HOUR: 25.0, // $25 for 1 hour
  TWO_HOURS: 45.0, // $45 for 2 hours
  FIVE_HOURS: 100.0, // $100 for 5 hours
  TWENTY_FOUR_HOURS: 350.0, // $350 for 24 hours (full battery)
};

export const chargingService = {
  /**
   * Get pricing for a charging duration
   */
  getPricing(duration: ChargingDuration): number {
    return CHARGING_PRICING[duration] || 0;
  },

  /**
   * Calculate total charging fee based on duration and number of cars
   */
  calculateChargingFee(duration: ChargingDuration, numberOfCars: number): number {
    const pricePerCar = this.getPricing(duration);
    return Math.round(pricePerCar * numberOfCars * 100) / 100;
  },

  /**
   * Create a new charging order
   */
  async createOrder(data: CreateChargingOrderDto) {
    const {
      userId,
      addressId,
      chargingDuration,
      numberOfCars,
      carIds,
      paymentMethod,
      scheduledAt,
      notes,
      tip = 0,
    } = data;

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

    // Verify all cars belong to user
    if (carIds.length !== numberOfCars) {
      throw new Error('Number of cars must match the number of car IDs provided');
    }

    const cars = await prisma.car.findMany({
      where: {
        id: { in: carIds },
        userId,
      },
    });

    if (cars.length !== carIds.length) {
      throw new Error('One or more cars not found or do not belong to user');
    }

    // Calculate distance from company to delivery address
    const distance = calculateDistance(
      COMPANY_LOCATION.latitude,
      COMPANY_LOCATION.longitude,
      address.latitude,
      address.longitude
    );

    // Calculate delivery fee
    const deliveryFee = calculateDeliveryFee(distance);

    // Calculate base charging fee (duration-based, multiplied by number of cars)
    const baseFee = this.calculateChargingFee(chargingDuration, numberOfCars);

    // Calculate subtotal (base fee + delivery fee)
    const subtotal = baseFee + deliveryFee;

    // Calculate tax
    const tax = calculateTax(subtotal, address.state || undefined);

    // Calculate total
    const totalAmount = Math.round((subtotal + tax + tip) * 100) / 100;

    // Generate order number
    const orderNumber = `CHG-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Create order
    const order = await prisma.chargingOrder.create({
      data: {
        userId,
        addressId,
        orderNumber,
        chargingDuration,
        numberOfCars,
        baseFee,
        deliveryFee,
        distance,
        tax,
        tip,
        totalAmount,
        status: ChargingOrderStatus.PENDING,
        paymentMethod,
        paymentStatus: PaymentStatus.PENDING,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        notes,
        cars: {
          create: carIds.map((carId) => ({
            carId,
          })),
        },
      },
      include: {
        address: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        cars: {
          include: {
            car: true,
          },
        },
      },
    });

    return order;
  },

  /**
   * Get all orders for a user
   */
  async getUserOrders(userId: string, isAdmin: boolean = false) {
    const where: any = {};
    if (!isAdmin) {
      where.userId = userId;
    }

    const orders = await prisma.chargingOrder.findMany({
      where,
      include: {
        address: true,
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        chargingUnit: {
          select: {
            id: true,
            name: true,
            type: true,
            connectorType: true,
          },
        },
        cars: {
          include: {
            car: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return orders;
  },

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string, userId?: string, isAdmin: boolean = false) {
    const where: { id: string; userId?: string } = { id: orderId };
    if (!isAdmin && userId) {
      where.userId = userId;
    }

    const order = await prisma.chargingOrder.findFirst({
      where,
      include: {
        address: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
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

    if (!order) {
      throw new Error('Order not found');
    }

    return order;
  },

  /**
   * Update order status (admin/driver only)
   */
  async updateOrderStatus(
    orderId: string,
    status: ChargingOrderStatus,
    driverId?: string,
    chargingUnitId?: string
  ) {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === ChargingOrderStatus.IN_PROGRESS && !driverId) {
      throw new Error('Driver ID is required when starting charging');
    }

    if (driverId) {
      updateData.driverId = driverId;
    }

    if (chargingUnitId) {
      updateData.chargingUnitId = chargingUnitId;
    }

    if (status === ChargingOrderStatus.IN_PROGRESS) {
      updateData.startedAt = new Date();
    }

    if (status === ChargingOrderStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }

    const order = await prisma.chargingOrder.update({
      where: { id: orderId },
      data: updateData,
      include: {
        address: true,
        driver: true,
        chargingUnit: true,
        cars: {
          include: {
            car: true,
          },
        },
      },
    });

    return order;
  },

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string, userId: string, reason?: string, isAdmin: boolean = false) {
    const where: { id: string; userId?: string } = { id: orderId };
    if (!isAdmin) {
      where.userId = userId;
    }

    const order = await prisma.chargingOrder.findFirst({ where });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status === ChargingOrderStatus.COMPLETED) {
      throw new Error('Cannot cancel a completed order');
    }

    if (order.status === ChargingOrderStatus.CANCELLED) {
      throw new Error('Order is already cancelled');
    }

    const updatedOrder = await prisma.chargingOrder.update({
      where: { id: orderId },
      data: {
        status: ChargingOrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
      include: {
        address: true,
        cars: {
          include: {
            car: true,
          },
        },
      },
    });

    return updatedOrder;
  },
};
