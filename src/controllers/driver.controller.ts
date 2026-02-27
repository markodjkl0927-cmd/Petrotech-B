import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ChargingOrderStatus, OrderStatus, PaymentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { getDriverEarnings } from '../services/driverEarnings.service';
import { stripeService } from '../services/stripe.service';
import { notifyUser, notifyDriver } from '../services/notification.service';
import { PayoutStatus } from '@prisma/client';

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

  // Driver live location (MVP). Driver app should call this while active.
  async updateLocation(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const driverId = req.user.userId;

      const latitude = Number((req.body as any)?.latitude);
      const longitude = Number((req.body as any)?.longitude);
      const accuracy = (req.body as any)?.accuracy;
      const heading = (req.body as any)?.heading;
      const speed = (req.body as any)?.speed;
      const orderType = (req.body as any)?.orderType;
      const orderId = (req.body as any)?.orderId;

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return res.status(400).json({ error: 'latitude and longitude are required' });
      }
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return res.status(400).json({ error: 'Invalid latitude/longitude' });
      }

      const location = await prisma.driverLocation.upsert({
        where: { driverId },
        create: {
          driverId,
          latitude,
          longitude,
          accuracy: typeof accuracy === 'number' ? accuracy : Number.isFinite(Number(accuracy)) ? Number(accuracy) : undefined,
          heading: typeof heading === 'number' ? heading : Number.isFinite(Number(heading)) ? Number(heading) : undefined,
          speed: typeof speed === 'number' ? speed : Number.isFinite(Number(speed)) ? Number(speed) : undefined,
        },
        update: {
          latitude,
          longitude,
          accuracy: typeof accuracy === 'number' ? accuracy : Number.isFinite(Number(accuracy)) ? Number(accuracy) : undefined,
          heading: typeof heading === 'number' ? heading : Number.isFinite(Number(heading)) ? Number(heading) : undefined,
          speed: typeof speed === 'number' ? speed : Number.isFinite(Number(speed)) ? Number(speed) : undefined,
        },
        select: {
          driverId: true,
          latitude: true,
          longitude: true,
          accuracy: true,
          heading: true,
          speed: true,
          updatedAt: true,
        },
      });

      // Dev-only logging to verify tracking (avoid logging sensitive live location in prod)
      if (process.env.NODE_ENV !== 'production') {
        const ctx = orderType && orderId ? ` ${String(orderType)}:${String(orderId)}` : '';
        console.log(
          `[tracking] driver=${driverId}${ctx} lat=${location.latitude.toFixed(5)} lng=${location.longitude.toFixed(
            5
          )} acc=${location.accuracy ?? '—'} heading=${location.heading ?? '—'} speed=${location.speed ?? '—'}`
        );
      }

      res.json({ location });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update driver location' });
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

      // Push: status update (customer)
      const statusMessages: Record<string, string> = {
        [OrderStatus.DISPATCHED]: 'Your driver is on the way.',
        [OrderStatus.IN_TRANSIT]: 'Your driver is on the way.',
        [OrderStatus.DELIVERED]: `Your fuel order #${order.orderNumber} has been delivered.`,
        [OrderStatus.CANCELLED]: `Order #${order.orderNumber} was cancelled.`,
      };
      const msg = statusMessages[status];
      if (msg) {
        notifyUser(order.userId, 'Order update', msg, { type: 'order_status', orderId: id, status }).catch(() => {});
      }

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

      // Push: charging status (customer)
      const statusMessages: Record<string, string> = {
        [ChargingOrderStatus.IN_PROGRESS]: 'Your EV charging session has started.',
        [ChargingOrderStatus.COMPLETED]: `Your EV charging order #${order.orderNumber} is complete.`,
        [ChargingOrderStatus.CANCELLED]: `Charging order #${order.orderNumber} was cancelled.`,
      };
      const msg = statusMessages[status];
      if (msg) {
        notifyUser(order.userId, 'Charging update', msg, { type: 'charging_status', orderId: id, status }).catch(() => {});
      }

      res.json({ order });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update charging order status' });
    }
  },

  // --- Earnings & payouts ---

  async getEarnings(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const driverId = req.user.userId;
      const earnings = await getDriverEarnings(driverId);
      res.json(earnings);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch earnings' });
    }
  },

  async requestPayout(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const driverId = req.user.userId;
      const { amount } = req.body as { amount?: number };

      if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: 'Valid amount (positive number) is required' });
      }

      const driver = await prisma.driver.findUnique({
        where: { id: driverId },
        select: { stripeConnectAccountId: true, firstName: true, lastName: true, email: true },
      });
      if (!driver) return res.status(404).json({ error: 'Driver not found' });
      if (!driver.stripeConnectAccountId) {
        return res.status(400).json({ error: 'Please set up your payout method first (bank or card)' });
      }

      const earnings = await getDriverEarnings(driverId);
      if (amount > earnings.availableBalance) {
        return res.status(400).json({ error: `Amount cannot exceed available balance ($${earnings.availableBalance.toFixed(2)})` });
      }
      if (amount < earnings.minPayoutAmount) {
        return res.status(400).json({ error: `Minimum payout is $${earnings.minPayoutAmount.toFixed(2)}` });
      }

      const amountCents = Math.round(amount * 100);
      let stripeTransferId: string | null = null;
      let status: PayoutStatus = PayoutStatus.PENDING;

      // When using test account from env, use it as transfer destination (avoids DB typo/stale ID)
      const testAccountId = process.env.STRIPE_CONNECT_TEST_ACCOUNT_ID?.trim();
      const destinationAccountId =
        testAccountId && testAccountId.startsWith('acct_') ? testAccountId : driver.stripeConnectAccountId;

      // Verify the destination account is accessible with this platform's key (same Stripe account, test mode)
      const account = await stripeService.getConnectAccount(destinationAccountId!);
      if (!account || account.deleted) {
        return res.status(400).json({
          error:
            'Connected account not found with your Stripe key. The account ID may be from a different Stripe account or live/test mode. In Dashboard: switch to Test mode, go to Connect → Connected accounts, open the account, and copy its ID again. Ensure you are in the same Stripe account that owns STRIPE_SECRET_KEY.',
        });
      }

      try {
        stripeTransferId = await stripeService.createTransferToConnect({
          amountCents,
          destinationStripeAccountId: destinationAccountId!,
          description: `Payout for ${driver.firstName} ${driver.lastName}`,
        });
        status = PayoutStatus.SUCCEEDED;
      } catch (e: any) {
        status = PayoutStatus.FAILED;
        const payoutRecord = await prisma.driverPayout.create({
          data: {
            driverId,
            amount,
            status: PayoutStatus.FAILED,
            failureReason: e?.message ?? 'Transfer failed',
          },
        });
        notifyDriver(driverId, 'Payout failed', `Your payout of $${amount.toFixed(2)} could not be completed. Check the app for details.`, { type: 'payout_failed', payoutId: payoutRecord.id }).catch(() => {});
        return res.status(502).json({
          error: e?.message || 'Payout failed',
          payout: { id: payoutRecord.id, status: payoutRecord.status },
        });
      }

      const payout = await prisma.driverPayout.create({
        data: {
          driverId,
          amount,
          status,
          stripeTransferId,
        },
      });
      notifyDriver(driverId, 'Payout sent', `Your payout of $${amount.toFixed(2)} has been sent to your account.`, { type: 'payout_succeeded', payoutId: payout.id }).catch(() => {});
      res.json({ payout });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to request payout' });
    }
  },

  async getPayouts(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const driverId = req.user.userId;
      const payouts = await prisma.driverPayout.findMany({
        where: { driverId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      res.json({ payouts });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch payouts' });
    }
  },

  async getConnectOnboardingLink(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const driverId = req.user.userId;
      const baseUrl = `${req.protocol}://${req.get('host')}`.replace(/\/api\/?$/, '');
      // App can pass returnUrl and refreshUrl (e.g. deep link) so driver returns to app after onboarding
      const returnUrl = (req.body?.returnUrl || req.query?.returnUrl as string) || `${baseUrl}/driver/connect-return`;
      const refreshUrl = (req.body?.refreshUrl || req.query?.refreshUrl as string) || `${baseUrl}/driver/connect-refresh`;

      let driver = await prisma.driver.findUnique({
        where: { id: driverId },
        select: { stripeConnectAccountId: true, email: true, firstName: true, lastName: true },
      });
      if (!driver) return res.status(404).json({ error: 'Driver not found' });

      if (!driver.stripeConnectAccountId) {
        const testAccountId = process.env.STRIPE_CONNECT_TEST_ACCOUNT_ID?.trim();
        if (testAccountId && testAccountId.startsWith('acct_')) {
          // Testing: use a pre-created Connect account (from Dashboard). Don't create account link - Stripe rejects links for accounts not created via API.
          await prisma.driver.update({
            where: { id: driverId },
            data: { stripeConnectAccountId: testAccountId },
          });
          return res.json({ url: null, alreadyConfigured: true });
        } else {
          try {
            const accountId = await stripeService.createConnectAccount({
              email: driver.email,
              firstName: driver.firstName,
              lastName: driver.lastName,
            });
            await prisma.driver.update({
              where: { id: driverId },
              data: { stripeConnectAccountId: accountId },
            });
            driver = { ...driver, stripeConnectAccountId: accountId };
          } catch (createErr: any) {
            const msg = createErr?.message || '';
            if (msg.includes('signed up for Connect')) {
              return res.status(503).json({
                error:
                  'Stripe Connect is not enabled for this account. In Stripe Dashboard go to Connect → complete platform setup, or set STRIPE_CONNECT_TEST_ACCOUNT_ID in backend .env to your test connected account ID (acct_...) for testing.',
              });
            }
            throw createErr;
          }
        }
      }

      // Don't create account link for test account (Dashboard-created) - Stripe rejects it
      const testAccountId = process.env.STRIPE_CONNECT_TEST_ACCOUNT_ID?.trim();
      if (testAccountId && driver.stripeConnectAccountId === testAccountId) {
        return res.json({ url: null, alreadyConfigured: true });
      }

      const url = await stripeService.createAccountLink(
        driver.stripeConnectAccountId!,
        refreshUrl,
        returnUrl
      );
      res.json({ url });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to create onboarding link' });
    }
  },

  async getConnectStatus(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const driverId = req.user.userId;
      const driver = await prisma.driver.findUnique({
        where: { id: driverId },
        select: { stripeConnectAccountId: true },
      });
      if (!driver?.stripeConnectAccountId) {
        return res.json({ hasConnectAccount: false, chargesEnabled: false, payoutsEnabled: false });
      }
      // Test account (Dashboard-created): treat as ready so Withdraw button shows without calling Stripe
      const testAccountId = process.env.STRIPE_CONNECT_TEST_ACCOUNT_ID?.trim();
      if (testAccountId && driver.stripeConnectAccountId === testAccountId) {
        return res.json({ hasConnectAccount: true, chargesEnabled: true, payoutsEnabled: true });
      }
      const account = await stripeService.getConnectAccount(driver.stripeConnectAccountId);
      if (!account || account.deleted) {
        return res.json({ hasConnectAccount: true, chargesEnabled: false, payoutsEnabled: false });
      }
      const acc = account as { charges_enabled?: boolean; payouts_enabled?: boolean; details_submitted?: boolean };
      // Express accounts: payouts_enabled means they can receive transfers; details_submitted means onboarding done
      const payoutsEnabled = !!acc.payouts_enabled || !!acc.details_submitted;
      res.json({
        hasConnectAccount: true,
        chargesEnabled: !!acc.charges_enabled,
        payoutsEnabled,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to get Connect status' });
    }
  },

  async registerPushToken(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const driverId = req.user.userId;
      const { token, platform } = req.body as { token?: string; platform?: string };
      if (!token || typeof token !== 'string' || !platform || !['ios', 'android', 'web'].includes(platform)) {
        return res.status(400).json({ error: 'token and platform (ios|android|web) are required' });
      }
      await prisma.pushToken.upsert({
        where: { token },
        create: { driverId, token, platform },
        update: { driverId, platform, updatedAt: new Date() },
      });
      console.log('[notification] Driver', driverId, 'registered push token (' + platform + ')');
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to register push token' });
    }
  },

  async getPushTokenStatus(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const driverId = req.user.userId;
      const count = await prisma.pushToken.count({
        where: { driverId, token: { startsWith: 'ExponentPushToken[' } },
      });
      res.json({ hasPushToken: count > 0 });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to get push status' });
    }
  },

  async getNotifications(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const driverId = req.user.userId;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const notifications = await prisma.driverNotification.findMany({
        where: { driverId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      const unreadCount = await prisma.driverNotification.count({
        where: { driverId, readAt: null },
      });
      res.json({
        notifications: notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          data: (() => {
            if (!n.data) return null;
            try {
              return JSON.parse(n.data);
            } catch {
              return null;
            }
          })(),
          readAt: n.readAt,
          createdAt: n.createdAt,
        })),
        unreadCount,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load notifications' });
    }
  },

  async markNotificationRead(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const driverId = req.user.userId;
      const { id } = req.params;
      await prisma.driverNotification.updateMany({
        where: { id, driverId },
        data: { readAt: new Date() },
      });
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to mark as read' });
    }
  },

  async markAllNotificationsRead(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const driverId = req.user.userId;
      await prisma.driverNotification.updateMany({
        where: { driverId, readAt: null },
        data: { readAt: new Date() },
      });
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to mark all as read' });
    }
  },
};

