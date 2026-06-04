import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

export const userController = {
  async getProfile(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to get profile' });
    }
  },

  async updateProfile(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { firstName, lastName, phone } = req.body;

      const user = await prisma.user.update({
        where: { id: req.user.userId },
        data: {
          firstName,
          lastName,
          phone,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          updatedAt: true,
        },
      });

      res.json({ user });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update profile' });
    }
  },

  async changePassword(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          error: 'Current password and new password are required',
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          error: 'New password must be at least 6 characters long',
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const isValidPassword = await bcrypt.compare(currentPassword, user.password);

      if (!isValidPassword) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: req.user.userId },
        data: { password: hashedPassword },
      });

      res.json({ message: 'Password changed successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to change password' });
    }
  },

  async registerPushToken(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { token, platform } = req.body as { token?: string; platform?: string };
      if (!token || typeof token !== 'string' || !platform || !['ios', 'android', 'web'].includes(platform)) {
        return res.status(400).json({ error: 'token and platform (ios|android|web) are required' });
      }

      await prisma.pushToken.upsert({
        where: { token },
        create: { userId: req.user.userId, token, platform },
        update: { userId: req.user.userId, platform, updatedAt: new Date() },
      });

      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to register push token' });
    }
  },

  async getNotifications(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const userId = req.user.userId;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const notifications = await prisma.userNotification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      const unreadCount = await prisma.userNotification.count({
        where: { userId, readAt: null },
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
      const userId = req.user.userId;
      const { id } = req.params;
      await prisma.userNotification.updateMany({
        where: { id, userId },
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
      const userId = req.user.userId;
      await prisma.userNotification.updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() },
      });
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to mark all as read' });
    }
  },
};

