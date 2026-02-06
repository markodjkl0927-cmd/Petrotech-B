import { prisma } from '../lib/prisma';
import { ChargingOrderStatus, OrderStatus, PaymentStatus, PayoutStatus } from '@prisma/client';

const MIN_PAYOUT_AMOUNT = 5; // dollars

export type RecentEarning = {
  id: string;
  orderNumber: string;
  type: 'fuel' | 'charging';
  amount: number;
  deliveredAt: string | null;
};

export type DriverEarningsResult = {
  totalEarned: number;
  totalPaidOut: number;
  availableBalance: number;
  recentEarnings: RecentEarning[];
  canWithdraw: boolean;
  minPayoutAmount: number;
};

/**
 * Compute driver earnings from delivered/paid orders (deliveryFee + tip) minus successful payouts.
 */
export async function getDriverEarnings(driverId: string): Promise<DriverEarningsResult> {
  // Fuel orders: DELIVERED + PAID
  const fuelOrders = await prisma.order.findMany({
    where: {
      driverId,
      status: OrderStatus.DELIVERED,
      paymentStatus: PaymentStatus.PAID,
    },
    select: {
      id: true,
      orderNumber: true,
      deliveryFee: true,
      tip: true,
      deliveredAt: true,
    },
  });

  // Charging orders: COMPLETED + PAID
  const chargingOrders = await prisma.chargingOrder.findMany({
    where: {
      driverId,
      status: ChargingOrderStatus.COMPLETED,
      paymentStatus: PaymentStatus.PAID,
    },
    select: {
      id: true,
      orderNumber: true,
      deliveryFee: true,
      tip: true,
      completedAt: true,
    },
  });

  let totalEarned = 0;
  const recentEarnings: RecentEarning[] = [];

  for (const o of fuelOrders) {
    const amount = (o.deliveryFee || 0) + (o.tip || 0);
    totalEarned += amount;
    if (amount > 0) {
      recentEarnings.push({
        id: o.id,
        orderNumber: o.orderNumber,
        type: 'fuel',
        amount,
        deliveredAt: o.deliveredAt?.toISOString() ?? null,
      });
    }
  }
  for (const o of chargingOrders) {
    const amount = (o.deliveryFee || 0) + (o.tip || 0);
    totalEarned += amount;
    if (amount > 0) {
      recentEarnings.push({
        id: o.id,
        orderNumber: o.orderNumber,
        type: 'charging',
        amount,
        deliveredAt: o.completedAt?.toISOString() ?? null,
      });
    }
  }

  // Sort by date descending
  recentEarnings.sort((a, b) => (b.deliveredAt || '').localeCompare(a.deliveredAt || ''));

  const payouts = await prisma.driverPayout.findMany({
    where: { driverId, status: PayoutStatus.SUCCEEDED },
    select: { amount: true },
  });
  const totalPaidOut = payouts.reduce((s, p) => s + p.amount, 0);
  const availableBalance = Math.max(0, totalEarned - totalPaidOut);
  const canWithdraw = availableBalance >= MIN_PAYOUT_AMOUNT;

  return {
    totalEarned,
    totalPaidOut,
    availableBalance,
    recentEarnings: recentEarnings.slice(0, 20),
    canWithdraw,
    minPayoutAmount: MIN_PAYOUT_AMOUNT,
  };
}
