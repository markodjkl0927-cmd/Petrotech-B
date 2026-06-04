import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { formatAccountNumberDisplay } from '../lib/rp-account';

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
};
