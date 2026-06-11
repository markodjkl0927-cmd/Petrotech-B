import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { formatAccountNumberDisplay } from '../lib/rp-account';

const CLOSED_APPLICATION_STATUSES = ['REJECTED', 'APPROVED', 'HIRED'];

export const rpMemberController = {
  async me(req: Request, res: Response) {
    try {
      const memberId = req.user?.userId;
      if (!memberId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const member = await prisma.rpMember.findUnique({
        where: { id: memberId },
        select: {
          id: true,
          accountNumber: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          createdAt: true,
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
      res.status(500).json({ error: error.message || 'Failed to load profile' });
    }
  },

  async card(req: Request, res: Response) {
    try {
      const memberId = req.user?.userId;
      if (!memberId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const member = await prisma.rpMember.findUnique({
        where: { id: memberId },
        select: {
          id: true,
          accountNumber: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      });
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }
      const lastFour = member.accountNumber.slice(-4);
      res.json({
        card: {
          holderName: `${member.firstName} ${member.lastName}`.toUpperCase(),
          accountNumber: member.accountNumber,
          accountNumberDisplay: formatAccountNumberDisplay(member.accountNumber),
          lastFour,
          brand: 'R&P Global Energies',
          type: 'MEMBER',
          status: 'ACTIVE',
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load card' });
    }
  },

  async updateProfile(req: Request, res: Response) {
    try {
      const memberId = req.user?.userId;
      if (!memberId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { firstName, lastName, phone, email } = req.body;

      if (!firstName?.trim() || !lastName?.trim() || !email?.trim()) {
        return res.status(400).json({ error: 'First name, last name, and email are required' });
      }

      const normalizedEmail = String(email).toLowerCase().trim();
      const emailTaken = await prisma.rpMember.findFirst({
        where: { email: normalizedEmail, NOT: { id: memberId } },
      });
      if (emailTaken) {
        return res.status(400).json({ error: 'An account with this email already exists' });
      }

      const member = await prisma.rpMember.update({
        where: { id: memberId },
        data: {
          firstName: String(firstName).trim(),
          lastName: String(lastName).trim(),
          email: normalizedEmail,
          phone: phone?.trim() ? String(phone).trim() : null,
        },
        select: {
          id: true,
          accountNumber: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.json({
        member: {
          ...member,
          accountNumberDisplay: formatAccountNumberDisplay(member.accountNumber),
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update profile' });
    }
  },

  async getDashboardStats(req: Request, res: Response) {
    try {
      const memberId = req.user?.userId;
      if (!memberId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const [
        member,
        activeStations,
        stateRows,
        openCareerJobs,
        dealershipApplicationsTotal,
        careerApplicationsTotal,
        dealershipApplicationsActive,
        careerApplicationsActive,
      ] = await Promise.all([
        prisma.rpMember.findUnique({
          where: { id: memberId },
          select: { isActive: true, accountNumber: true },
        }),
        prisma.rpFuelLocation.count({ where: { isActive: true } }),
        prisma.rpFuelLocation.findMany({
          where: { isActive: true },
          distinct: ['state'],
          select: { state: true },
        }),
        prisma.rpCareerJob.count({ where: { isActive: true } }),
        prisma.rpDealershipApplication.count({ where: { memberId } }),
        prisma.rpCareerApplication.count({ where: { memberId } }),
        prisma.rpDealershipApplication.count({
          where: { memberId, status: { notIn: CLOSED_APPLICATION_STATUSES } },
        }),
        prisma.rpCareerApplication.count({
          where: { memberId, status: { notIn: CLOSED_APPLICATION_STATUSES } },
        }),
      ]);

      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }

      const dealershipProgramOpen = true;

      res.json({
        stats: {
          membership: {
            active: member.isActive,
            cardReady: !!member.accountNumber,
          },
          fuelNetwork: {
            activeStations,
            states: stateRows.length,
          },
          programs: {
            openCareerJobs,
            dealershipOpen: dealershipProgramOpen,
            openTotal: openCareerJobs + (dealershipProgramOpen ? 1 : 0),
          },
          applications: {
            total: dealershipApplicationsTotal + careerApplicationsTotal,
            active: dealershipApplicationsActive + careerApplicationsActive,
            dealership: dealershipApplicationsTotal,
            career: careerApplicationsTotal,
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch dashboard stats' });
    }
  },

  async listApplications(req: Request, res: Response) {
    try {
      const memberId = req.user?.userId;
      if (!memberId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const [dealershipRows, careerRows] = await Promise.all([
        prisma.rpDealershipApplication.findMany({
          where: { memberId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            createdAt: true,
            answers: true,
          },
        }),
        prisma.rpCareerApplication.findMany({
          where: { memberId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            createdAt: true,
            job: {
              select: {
                id: true,
                title: true,
                location: true,
                department: true,
                isActive: true,
              },
            },
          },
        }),
      ]);

      const dealershipApplications = dealershipRows.map((application) => {
        const answers = (application.answers || {}) as Record<string, unknown>;
        return {
          id: application.id,
          status: application.status,
          createdAt: application.createdAt,
          companyName: typeof answers.companyName === 'string' ? answers.companyName : null,
          city: typeof answers.city === 'string' ? answers.city : null,
          state: typeof answers.state === 'string' ? answers.state : null,
          dealershipType: typeof answers.dealershipType === 'string' ? answers.dealershipType : null,
        };
      });

      res.json({
        dealershipApplications,
        careerApplications: careerRows,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load applications' });
    }
  },

  async changePassword(req: Request, res: Response) {
    try {
      const memberId = req.user?.userId;
      if (!memberId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters' });
      }

      const member = await prisma.rpMember.findUnique({ where: { id: memberId } });
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }

      const valid = await bcrypt.compare(currentPassword, member.password);
      if (!valid) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await prisma.rpMember.update({
        where: { id: memberId },
        data: { password: hashedPassword },
      });

      res.json({ message: 'Password changed successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to change password' });
    }
  },
};
