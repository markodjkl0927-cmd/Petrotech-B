import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const productController = {
  async getAll(req: Request, res: Response) {
    try {
      const products = await prisma.product.findMany({
        where: {
          isAvailable: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      res.json({ products });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch products' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const product = await prisma.product.findUnique({
        where: { id },
      });

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.json({ product });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch product' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { name, description, pricePerLiter, unit, isAvailable } = req.body;

      if (!name || !pricePerLiter) {
        return res.status(400).json({
          error: 'Name and pricePerLiter are required',
        });
      }

      const product = await prisma.product.create({
        data: {
          name,
          description,
          pricePerLiter: parseFloat(pricePerLiter),
          unit: unit || 'liter',
          isAvailable: isAvailable !== undefined ? isAvailable : true,
        },
      });

      res.status(201).json({ product });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to create product' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      const { name, description, pricePerLiter, unit, isAvailable } = req.body;

      const product = await prisma.product.update({
        where: { id },
        data: {
          name,
          description,
          pricePerLiter: pricePerLiter ? parseFloat(pricePerLiter) : undefined,
          unit,
          isAvailable,
        },
      });

      res.json({ product });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update product' });
    }
  },
};

