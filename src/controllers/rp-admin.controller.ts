import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const rpAdminController = {
  async listLocations(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;
      const [locations, total] = await Promise.all([
        prisma.rpFuelLocation.findMany({
          orderBy: [{ state: 'asc' }, { city: 'asc' }, { address: 'asc' }],
          skip,
          take: limit,
        }),
        prisma.rpFuelLocation.count(),
      ]);
      res.json({
        locations,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch locations' });
    }
  },

  async createLocation(req: Request, res: Response) {
    try {
      const { state, city, address, name, phone, isActive } = req.body;
      if (!state || !city || !address) {
        return res.status(400).json({ error: 'State, city, and address are required' });
      }
      const location = await prisma.rpFuelLocation.create({
        data: {
          state: String(state).trim(),
          city: String(city).trim(),
          address: String(address).trim(),
          name: name?.trim() || null,
          phone: phone?.trim() || null,
          isActive: isActive !== false,
        },
      });
      res.status(201).json({ location });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to create location' });
    }
  },

  async updateLocation(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { state, city, address, name, phone, isActive } = req.body;
      const location = await prisma.rpFuelLocation.update({
        where: { id },
        data: {
          ...(state !== undefined && { state: String(state).trim() }),
          ...(city !== undefined && { city: String(city).trim() }),
          ...(address !== undefined && { address: String(address).trim() }),
          ...(name !== undefined && { name: name?.trim() || null }),
          ...(phone !== undefined && { phone: phone?.trim() || null }),
          ...(isActive !== undefined && { isActive: !!isActive }),
        },
      });
      res.json({ location });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update location' });
    }
  },

  async deleteLocation(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await prisma.rpFuelLocation.delete({ where: { id } });
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to delete location' });
    }
  },

  async listJobs(_req: Request, res: Response) {
    try {
      const jobs = await prisma.rpCareerJob.findMany({ orderBy: { createdAt: 'desc' } });
      res.json({ jobs });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch jobs' });
    }
  },

  async createJob(req: Request, res: Response) {
    try {
      const { title, description, location, department, isActive } = req.body;
      if (!title || !description) {
        return res.status(400).json({ error: 'Title and description are required' });
      }
      const job = await prisma.rpCareerJob.create({
        data: {
          title: String(title).trim(),
          description: String(description).trim(),
          location: location?.trim() || null,
          department: department?.trim() || null,
          isActive: isActive !== false,
        },
      });
      res.status(201).json({ job });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to create job' });
    }
  },

  async updateJob(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { title, description, location, department, isActive } = req.body;
      const job = await prisma.rpCareerJob.update({
        where: { id },
        data: {
          ...(title !== undefined && { title: String(title).trim() }),
          ...(description !== undefined && { description: String(description).trim() }),
          ...(location !== undefined && { location: location?.trim() || null }),
          ...(department !== undefined && { department: department?.trim() || null }),
          ...(isActive !== undefined && { isActive: !!isActive }),
        },
      });
      res.json({ job });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update job' });
    }
  },

  async deleteJob(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await prisma.rpCareerJob.delete({ where: { id } });
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to delete job' });
    }
  },

  async listCareerApplications(_req: Request, res: Response) {
    try {
      const applications = await prisma.rpCareerApplication.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          job: { select: { title: true } },
          member: {
            select: {
              accountNumber: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
        },
      });
      res.json({ applications });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch applications' });
    }
  },

  async listDealershipApplications(_req: Request, res: Response) {
    try {
      const applications = await prisma.rpDealershipApplication.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          member: {
            select: {
              accountNumber: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
        },
      });
      res.json({ applications });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch applications' });
    }
  },

  async updateDealershipStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }
      const application = await prisma.rpDealershipApplication.update({
        where: { id },
        data: { status: String(status) },
      });
      res.json({ application });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update application' });
    }
  },
};
