import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { sendEmail } from '../services/email.service';
import { sendMemberApplicationSubmittedEmail } from '../services/rp-application-email.service';

function getPortalUrl(): string {
  return (process.env.RP_PORTAL_URL || process.env.FRONTEND_URL || 'https://randpglobalenergies.com').replace(
    /\/$/,
    ''
  );
}

function getCareerNotifyEmail(): string {
  return (
    process.env.RP_CAREER_NOTIFY_EMAIL ||
    process.env.RP_DEALERSHIP_NOTIFY_EMAIL ||
    process.env.RP_ADMIN_EMAIL ||
    'admin@randpglobalenergies.com'
  );
}

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
          job: { select: { title: true, location: true, department: true } },
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

      const notifyEmail = getCareerNotifyEmail();
      try {
        await sendEmail({
          to: notifyEmail,
          subject: `New R&P Career application — ${application.job.title} — ${application.member.firstName} ${application.member.lastName}`,
          text: [
            'A new career application was submitted.',
            '',
            `Position: ${application.job.title}`,
            `Location: ${application.job.location || '—'}`,
            `Department: ${application.job.department || '—'}`,
            '',
            `Applicant: ${application.member.firstName} ${application.member.lastName}`,
            `Account: ${application.member.accountNumber}`,
            `Email: ${application.member.email}`,
            `Phone: ${application.member.phone || '—'}`,
            '',
            'Cover letter:',
            application.coverLetter?.trim() || '—',
            '',
            `Resume file: ${file.originalname || file.filename}`,
            '',
            `Review and update status in the admin portal:`,
            `${getPortalUrl()}/admin/applications`,
          ].join('\n'),
        });
      } catch (emailError) {
        console.error('[R&P career] application saved but notify email failed', {
          applicationId: application.id,
          notifyEmail,
          error: emailError,
        });
      }

      try {
        await sendMemberApplicationSubmittedEmail({
          to: application.member.email,
          firstName: application.member.firstName,
          type: 'career',
          title: application.job.title,
        });
      } catch (emailError) {
        console.error('[R&P career] application saved but member confirmation email failed', {
          applicationId: application.id,
          error: emailError,
        });
      }

      res.status(201).json({ application });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to submit application' });
    }
  },
};
