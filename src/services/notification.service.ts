import Expo from 'expo-server-sdk';
import { prisma } from '../lib/prisma';

let expo: Expo | null = null;

function getExpo(): Expo {
  if (!expo) expo = new Expo();
  return expo;
}

export type NotificationPayload = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
};

/**
 * Send push notifications via Expo Push API.
 * Only sends to valid Expo push tokens (ExponentPushToken[...]).
 */
export async function sendExpoPushNotifications(messages: NotificationPayload[]): Promise<void> {
  if (messages.length === 0) return;
  const client = getExpo();
  const expoMessages = messages.map((m) => ({
    to: m.to,
    title: m.title,
    body: m.body,
    data: m.data,
    sound: m.sound ?? 'default',
    priority: m.priority ?? 'high',
  }));
  const chunks = client.chunkPushNotifications(expoMessages);

  for (const chunk of chunks) {
    try {
      const receipts = await client.sendPushNotificationsAsync(chunk);
      receipts.forEach((receipt: { status: string; details?: { error?: string } }, i: number) => {
        if (receipt.status === 'error' && receipt.details?.error === 'DeviceNotRegistered') {
          const msg = chunk[i] as { to?: string };
          if (typeof msg?.to === 'string') {
            prisma.pushToken.deleteMany({ where: { token: msg.to } }).catch(() => {});
          }
        }
      });
    } catch (e) {
      console.error('[notification] send failed', e);
    }
  }
}

/**
 * Get all Expo push tokens for a user (customer app).
 */
export async function getExpoTokensByUserId(userId: string): Promise<string[]> {
  const rows = await prisma.pushToken.findMany({
    where: { userId, token: { startsWith: 'ExponentPushToken[' } },
    select: { token: true },
  });
  return rows.map((r) => r.token);
}

/**
 * Get all Expo push tokens for a driver (driver app).
 */
export async function getExpoTokensByDriverId(driverId: string): Promise<string[]> {
  const rows = await prisma.pushToken.findMany({
    where: { driverId, token: { startsWith: 'ExponentPushToken[' } },
    select: { token: true },
  });
  return rows.map((r) => r.token);
}

/**
 * Notify a customer (by userId). No-op if no tokens.
 */
export async function notifyUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  const tokens = await getExpoTokensByUserId(userId);
  if (tokens.length === 0) return;
  await sendExpoPushNotifications(
    tokens.map((to) => ({
      to,
      title,
      body,
      data,
      sound: 'default',
      priority: 'high',
    }))
  );
}

/**
 * Notify a driver (by driverId). Sends push and saves to notification history for in-app list.
 */
export async function notifyDriver(
  driverId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  type?: string
): Promise<void> {
  const notifType = type ?? (data?.type as string) ?? 'info';

  await prisma.driverNotification.create({
    data: {
      driverId,
      type: notifType,
      title,
      body,
      data: data ? JSON.stringify(data) : null,
    },
  });

  const tokens = await getExpoTokensByDriverId(driverId);
  if (tokens.length === 0) {
    console.warn('[notification] No push tokens for driver', driverId, '- driver will not get push. Use a dev/production build (not Expo Go), allow notifications, and ensure driver opened the app after login.');
    return;
  }
  console.log('[notification] Sending push to driver', driverId, '(', tokens.length, 'device(s))');
  await sendExpoPushNotifications(
    tokens.map((to) => ({
      to,
      title,
      body,
      data,
      sound: 'default',
      priority: 'high',
    }))
  );
}
