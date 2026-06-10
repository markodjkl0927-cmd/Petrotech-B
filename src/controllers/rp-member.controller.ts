import bcrypt from 'bcryptjs';
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
