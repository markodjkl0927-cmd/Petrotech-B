import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const addressController = {
  async getAll(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const addresses = await prisma.address.findMany({
        where: { userId: req.user.userId },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'desc' },
        ],
      });

      res.json({ addresses });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch addresses' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;

      const address = await prisma.address.findFirst({
        where: {
          id,
          userId: req.user.userId,
        },
      });

      if (!address) {
        return res.status(404).json({ error: 'Address not found' });
      }

      res.json({ address });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch address' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { label, street, city, state, zipCode, country, latitude, longitude, instructions, isDefault } = req.body;

      if (!label || !street || !city || !zipCode) {
        return res.status(400).json({
          error: 'Label, street, city, and zipCode are required',
        });
      }

      // If setting as default, unset other defaults
      if (isDefault) {
        await prisma.address.updateMany({
          where: { userId: req.user.userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const address = await prisma.address.create({
        data: {
          userId: req.user.userId,
          label,
          street,
          city,
          state,
          zipCode,
          country: country || 'US',
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          instructions,
          isDefault: isDefault || false,
        },
      });

      res.status(201).json({ address });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to create address' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      const { label, street, city, state, zipCode, country, latitude, longitude, instructions, isDefault } = req.body;

      // Check if address belongs to user
      const existingAddress = await prisma.address.findFirst({
        where: {
          id,
          userId: req.user.userId,
        },
      });

      if (!existingAddress) {
        return res.status(404).json({ error: 'Address not found' });
      }

      // If setting as default, unset other defaults
      if (isDefault) {
        await prisma.address.updateMany({
          where: { userId: req.user.userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const address = await prisma.address.update({
        where: { id },
        data: {
          label,
          street,
          city,
          state,
          zipCode,
          country,
          latitude: latitude ? parseFloat(latitude) : undefined,
          longitude: longitude ? parseFloat(longitude) : undefined,
          instructions,
          isDefault: isDefault !== undefined ? isDefault : existingAddress.isDefault,
        },
      });

      res.json({ address });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update address' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;

      // Check if address belongs to user
      const address = await prisma.address.findFirst({
        where: {
          id,
          userId: req.user.userId,
        },
      });

      if (!address) {
        return res.status(404).json({ error: 'Address not found' });
      }

      await prisma.address.delete({
        where: { id },
      });

      res.json({ message: 'Address deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to delete address' });
    }
  },

  async setDefault(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;

      // Check if address belongs to user
      const address = await prisma.address.findFirst({
        where: {
          id,
          userId: req.user.userId,
        },
      });

      if (!address) {
        return res.status(404).json({ error: 'Address not found' });
      }

      // Unset all defaults
      await prisma.address.updateMany({
        where: { userId: req.user.userId, isDefault: true },
        data: { isDefault: false },
      });

      // Set this as default
      const updatedAddress = await prisma.address.update({
        where: { id },
        data: { isDefault: true },
      });

      res.json({ address: updatedAddress });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to set default address' });
    }
  },
};

