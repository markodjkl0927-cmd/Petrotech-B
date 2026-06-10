import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { formatAccountNumberDisplay } from '../lib/rp-account';

const PENDING_DEALERSHIP_STATUSES = ['NEW', 'UNDER_REVIEW'];
const PENDING_CAREER_STATUSES = ['NEW', 'UNDER_REVIEW', 'INTERVIEW'];

function parsePageQuery(req: Request) {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

export const rpAdminController = {
  async getDashboardStats(_req: Request, res: Response) {
    try {
      const [
        membersTotal,
        membersActive,
        locationsTotal,
        locationsActive,
        careerJobsTotal,
        careerJobsActive,
        dealershipApplicationsTotal,
        dealershipApplicationsPending,
        careerApplicationsTotal,
        careerApplicationsPending,
      ] = await Promise.all([
        prisma.rpMember.count(),
        prisma.rpMember.count({ where: { isActive: true } }),
        prisma.rpFuelLocation.count(),
        prisma.rpFuelLocation.count({ where: { isActive: true } }),
        prisma.rpCareerJob.count(),
        prisma.rpCareerJob.count({ where: { isActive: true } }),
        prisma.rpDealershipApplication.count(),
        prisma.rpDealershipApplication.count({
          where: { status: { in: PENDING_DEALERSHIP_STATUSES } },
        }),
        prisma.rpCareerApplication.count(),
        prisma.rpCareerApplication.count({
          where: { status: { in: PENDING_CAREER_STATUSES } },
        }),
      ]);

      res.json({
        stats: {
          members: {
            total: membersTotal,
            active: membersActive,
            inactive: membersTotal - membersActive,
          },
          locations: {
            total: locationsTotal,
            active: locationsActive,
          },
          careerJobs: {
            total: careerJobsTotal,
            active: careerJobsActive,
          },
          dealershipApplications: {
            total: dealershipApplicationsTotal,
            pending: dealershipApplicationsPending,
          },
          careerApplications: {
            total: careerApplicationsTotal,
            pending: careerApplicationsPending,
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch dashboard stats' });
    }
  },

  async listLocations(req: Request, res: Response) {
    try {
      const { page, limit, skip } = parsePageQuery(req);
      const q = String(req.query.q || '').trim();
      const state = String(req.query.state || '').trim();

      const where: {
        state?: { contains: string; mode: 'insensitive' };
        OR?: Array<{
          state?: { contains: string; mode: 'insensitive' };
          city?: { contains: string; mode: 'insensitive' };
          address?: { contains: string; mode: 'insensitive' };
          name?: { contains: string; mode: 'insensitive' };
        }>;
      } = {};

      if (state) {
        where.state = { contains: state, mode: 'insensitive' };
      } else if (q) {
        where.OR = [
          { state: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
          { address: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ];
      }

      const [locations, total] = await Promise.all([
        prisma.rpFuelLocation.findMany({
          where,
          orderBy: [{ state: 'asc' }, { city: 'asc' }, { address: 'asc' }],
          skip,
          take: limit,
        }),
        prisma.rpFuelLocation.count({ where }),
      ]);
      res.json({
        locations,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
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

  async listJobs(req: Request, res: Response) {
    try {
      const { page, limit, skip } = parsePageQuery(req);
      const q = String(req.query.q || '').trim();
      const status = String(req.query.status || 'all').toLowerCase();

      const where: {
        isActive?: boolean;
        OR?: Array<{
          title?: { contains: string; mode: 'insensitive' };
          location?: { contains: string; mode: 'insensitive' };
          department?: { contains: string; mode: 'insensitive' };
        }>;
      } = {};

      if (status === 'active') where.isActive = true;
      if (status === 'inactive') where.isActive = false;

      if (q) {
        where.OR = [
          { title: { contains: q, mode: 'insensitive' } },
          { location: { contains: q, mode: 'insensitive' } },
          { department: { contains: q, mode: 'insensitive' } },
        ];
      }

      const [jobs, total] = await Promise.all([
        prisma.rpCareerJob.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.rpCareerJob.count({ where }),
      ]);

      res.json({
        jobs,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      });
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

  async listCareerApplications(req: Request, res: Response) {
    try {
      const { page, limit, skip } = parsePageQuery(req);
      const q = String(req.query.q || '').trim();
      const status = String(req.query.status || 'all').toUpperCase().trim();

      const where: {
        status?: string;
        OR?: Array<{
          member?: {
            email?: { contains: string; mode: 'insensitive' };
            firstName?: { contains: string; mode: 'insensitive' };
            lastName?: { contains: string; mode: 'insensitive' };
            accountNumber?: { contains: string };
          };
          job?: { title?: { contains: string; mode: 'insensitive' } };
        }>;
      } = {};

      if (status && status !== 'ALL') {
        where.status = status;
      }

      if (q) {
        const digits = q.replace(/\D/g, '');
        where.OR = [
          { member: { email: { contains: q, mode: 'insensitive' } } },
          { member: { firstName: { contains: q, mode: 'insensitive' } } },
          { member: { lastName: { contains: q, mode: 'insensitive' } } },
          { job: { title: { contains: q, mode: 'insensitive' } } },
        ];
        if (digits) {
          where.OR.push({ member: { accountNumber: { contains: digits } } });
        }
      }

      const [applications, total] = await Promise.all([
        prisma.rpCareerApplication.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
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
        }),
        prisma.rpCareerApplication.count({ where }),
      ]);

      res.json({
        applications,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch applications' });
    }
  },

  async listDealershipApplications(req: Request, res: Response) {
    try {
      const { page, limit, skip } = parsePageQuery(req);
      const q = String(req.query.q || '').trim();
      const status = String(req.query.status || 'all').toUpperCase().trim();

      const where: {
        status?: string;
        OR?: Array<{
          member?: {
            email?: { contains: string; mode: 'insensitive' };
            firstName?: { contains: string; mode: 'insensitive' };
            lastName?: { contains: string; mode: 'insensitive' };
            accountNumber?: { contains: string };
          };
        }>;
      } = {};

      if (status && status !== 'ALL') {
        where.status = status;
      }

      if (q) {
        const digits = q.replace(/\D/g, '');
        where.OR = [
          { member: { email: { contains: q, mode: 'insensitive' } } },
          { member: { firstName: { contains: q, mode: 'insensitive' } } },
          { member: { lastName: { contains: q, mode: 'insensitive' } } },
        ];
        if (digits) {
          where.OR.push({ member: { accountNumber: { contains: digits } } });
        }
      }

      const [applications, total] = await Promise.all([
        prisma.rpDealershipApplication.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
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
        }),
        prisma.rpDealershipApplication.count({ where }),
      ]);

      res.json({
        applications,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      });
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

      const normalized = String(status).toUpperCase().trim();
      const allowed = ['NEW', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'];
      if (!allowed.includes(normalized)) {
        return res.status(400).json({
          error: `Invalid status. Allowed: ${allowed.join(', ')}`,
        });
      }

      const application = await prisma.rpDealershipApplication.update({
        where: { id },
        data: { status: normalized },
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
      res.json({ application });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update application' });
    }
  },

  async updateCareerStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }

      const normalized = String(status).toUpperCase().trim();
      const allowed = ['NEW', 'UNDER_REVIEW', 'INTERVIEW', 'HIRED', 'REJECTED'];
      if (!allowed.includes(normalized)) {
        return res.status(400).json({
          error: `Invalid status. Allowed: ${allowed.join(', ')}`,
        });
      }

      const application = await prisma.rpCareerApplication.update({
        where: { id },
        data: { status: normalized },
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
      res.json({ application });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update application' });
    }
  },

  async listMembers(req: Request, res: Response) {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;
      const q = String(req.query.q || '').trim();
      const status = String(req.query.status || 'all').toLowerCase();

      const where: {
        isActive?: boolean;
        OR?: Array<{
          email?: { contains: string; mode: 'insensitive' };
          firstName?: { contains: string; mode: 'insensitive' };
          lastName?: { contains: string; mode: 'insensitive' };
          accountNumber?: { contains: string };
        }>;
      } = {};

      if (status === 'active') where.isActive = true;
      if (status === 'inactive') where.isActive = false;

      if (q) {
        const digits = q.replace(/\D/g, '');
        where.OR = [
          { email: { contains: q, mode: 'insensitive' } },
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
        ];
        if (digits) {
          where.OR.push({ accountNumber: { contains: digits } });
        }
      }

      const [members, total] = await Promise.all([
        prisma.rpMember.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            accountNumber: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                dealershipApplications: true,
                careerApplications: true,
              },
            },
          },
        }),
        prisma.rpMember.count({ where }),
      ]);

      res.json({
        members: members.map((m) => ({
          ...m,
          accountNumberDisplay: formatAccountNumberDisplay(m.accountNumber),
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch members' });
    }
  },

  async getMember(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const member = await prisma.rpMember.findUnique({
        where: { id },
        select: {
          id: true,
          accountNumber: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              dealershipApplications: true,
              careerApplications: true,
            },
          },
          dealershipApplications: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { id: true, status: true, createdAt: true },
          },
          careerApplications: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: { job: { select: { title: true } } },
          },
        },
      });

      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }

      res.json({
        member: {
          ...member,
          accountNumberDisplay: formatAccountNumberDisplay(member.accountNumber),
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load member' });
    }
  },

  async updateMember(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      if (isActive === undefined) {
        return res.status(400).json({ error: 'isActive is required' });
      }

      const member = await prisma.rpMember.update({
        where: { id },
        data: { isActive: !!isActive },
        select: {
          id: true,
          accountNumber: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              dealershipApplications: true,
              careerApplications: true,
            },
          },
        },
      });

      res.json({
        member: {
          ...member,
          accountNumberDisplay: formatAccountNumberDisplay(member.accountNumber),
        },
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update member' });
    }
  },
};
