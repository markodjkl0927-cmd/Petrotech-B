import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { sendEmail } from '../services/email.service';

export const rpDealershipController = {
  async submit(req: Request, res: Response) {
    try {
      const memberId = req.user?.userId;
      if (!memberId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { answers } = req.body;
      if (!answers || typeof answers !== 'object') {
        return res.status(400).json({ error: 'Application answers are required' });
      }

      const application = await prisma.rpDealershipApplication.create({
        data: {
          memberId,
          answers,
        },
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

      const notifyEmail =
        process.env.RP_DEALERSHIP_NOTIFY_EMAIL ||
        process.env.RP_ADMIN_EMAIL ||
        'admin@randpglobalenergies.com';

      const summary = JSON.stringify(answers, null, 2);
      await sendEmail({
        to: notifyEmail,
        subject: `New R&P Dealership application — ${application.member.firstName} ${application.member.lastName}`,
        text: [
          'A new dealership program application was submitted.',
          '',
          `Member: ${application.member.firstName} ${application.member.lastName}`,
          `Account: ${application.member.accountNumber}`,
          `Email: ${application.member.email}`,
          `Phone: ${application.member.phone || '—'}`,
          '',
          'Answers:',
          summary,
        ].join('\n'),
      });

      res.status(201).json({ application: { id: application.id, status: application.status } });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to submit application' });
    }
  },
};
