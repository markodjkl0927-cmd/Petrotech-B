import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const rpCareerController = {
  async listJobs(_req: Request, res: Response) {
    try {
      const jobs = await prisma.rpCareerJob.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          location: true,
          department: true,
          createdAt: true,
        },
      });
      res.json({ jobs });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load jobs' });
    }
  },

  async getJob(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const job = await prisma.rpCareerJob.findFirst({
        where: { id, isActive: true },
      });
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      res.json({ job });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load job' });
    }
  },

  async apply(req: Request, res: Response) {
    try {
      const memberId = req.user?.userId;
      if (!memberId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const { id: jobId } = req.params;
      const coverLetter = req.body?.coverLetter as string | undefined;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'Resume file is required' });
      }

      const job = await prisma.rpCareerJob.findFirst({
        where: { id: jobId, isActive: true },
      });
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      const resumeUrl = `/uploads/rp/careers/${file.filename}`;

      const application = await prisma.rpCareerApplication.create({
        data: {
          jobId,
          memberId,
          resumeUrl,
          coverLetter: coverLetter?.trim() || null,
        },
        include: {
          job: { select: { title: true } },
        },
      });

      res.status(201).json({ application });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to submit application' });
    }
  },
};
