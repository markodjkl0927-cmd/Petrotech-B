import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const rpLocatorController = {
  async listStates(_req: Request, res: Response) {
    try {
      const rows = await prisma.rpFuelLocation.findMany({
        where: { isActive: true },
        select: { state: true },
        distinct: ['state'],
        orderBy: { state: 'asc' },
      });
      res.json({ states: rows.map((r) => r.state) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load states' });
    }
  },

  async listCities(req: Request, res: Response) {
    try {
      const state = String(req.query.state || '').trim();
      if (!state) {
        return res.status(400).json({ error: 'State is required' });
      }
      const rows = await prisma.rpFuelLocation.findMany({
        where: { isActive: true, state },
        select: { city: true },
        distinct: ['city'],
        orderBy: { city: 'asc' },
      });
      res.json({ cities: rows.map((r) => r.city) });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load cities' });
    }
  },

  async listLocations(req: Request, res: Response) {
    try {
      const state = String(req.query.state || '').trim();
      const city = String(req.query.city || '').trim();
      if (!state || !city) {
        return res.status(400).json({ error: 'State and city are required' });
      }
      const locations = await prisma.rpFuelLocation.findMany({
        where: { isActive: true, state, city },
        orderBy: [{ name: 'asc' }, { address: 'asc' }],
      });
      res.json({ locations });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load locations' });
    }
  },
};
