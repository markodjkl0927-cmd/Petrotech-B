import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const carController = {
  /**
   * Get all cars for the current user
   */
  async getCars(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const cars = await prisma.car.findMany({
        where: { userId },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'desc' },
        ],
      });

      res.json(cars);
    } catch (error: any) {
      console.error('Error fetching cars:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch cars' });
    }
  },

  /**
   * Get car by ID
   */
  async getCarById(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      const car = await prisma.car.findFirst({
        where: { id, userId },
      });

      if (!car) {
        return res.status(404).json({ error: 'Car not found' });
      }

      res.json(car);
    } catch (error: any) {
      console.error('Error fetching car:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch car' });
    }
  },

  /**
   * Create a new car
   */
  async create(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const {
        make,
        model,
        year,
        connectorType,
        batteryCapacity,
        licensePlate,
        color,
        nickname,
        isDefault,
      } = req.body;

      // Validation
      if (!make || !model || !connectorType) {
        return res.status(400).json({
          error: 'Missing required fields: make, model, connectorType',
        });
      }

      // If setting as default, unset other defaults
      if (isDefault) {
        await prisma.car.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const car = await prisma.car.create({
        data: {
          userId,
          make,
          model,
          year: year ? parseInt(year) : null,
          connectorType,
          batteryCapacity: batteryCapacity ? parseFloat(batteryCapacity) : null,
          licensePlate,
          color,
          nickname,
          isDefault: isDefault || false,
        },
      });

      res.status(201).json(car);
    } catch (error: any) {
      console.error('Error creating car:', error);
      res.status(400).json({ error: error.message || 'Failed to create car' });
    }
  },

  /**
   * Update a car
   */
  async update(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      const {
        make,
        model,
        year,
        connectorType,
        batteryCapacity,
        licensePlate,
        color,
        nickname,
        isDefault,
      } = req.body;

      // Verify car belongs to user
      const existingCar = await prisma.car.findFirst({
        where: { id, userId },
      });

      if (!existingCar) {
        return res.status(404).json({ error: 'Car not found' });
      }

      // If setting as default, unset other defaults
      if (isDefault) {
        await prisma.car.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const car = await prisma.car.update({
        where: { id },
        data: {
          make,
          model,
          year: year !== undefined ? (year ? parseInt(year) : null) : undefined,
          connectorType,
          batteryCapacity: batteryCapacity !== undefined ? (batteryCapacity ? parseFloat(batteryCapacity) : null) : undefined,
          licensePlate,
          color,
          nickname,
          isDefault: isDefault !== undefined ? isDefault : undefined,
        },
      });

      res.json(car);
    } catch (error: any) {
      console.error('Error updating car:', error);
      res.status(400).json({ error: error.message || 'Failed to update car' });
    }
  },

  /**
   * Delete a car
   */
  async delete(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;

      // Verify car belongs to user
      const car = await prisma.car.findFirst({
        where: { id, userId },
      });

      if (!car) {
        return res.status(404).json({ error: 'Car not found' });
      }

      await prisma.car.delete({
        where: { id },
      });

      res.json({ message: 'Car deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting car:', error);
      res.status(400).json({ error: error.message || 'Failed to delete car' });
    }
  },
};
