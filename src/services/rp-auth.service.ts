import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { generateUniqueAccountNumber, formatAccountNumberDisplay } from '../lib/rp-account';
import { sendEmail } from './email.service';

const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';

export type RpMemberAuthResponse = {
  member: {
    id: string;
    accountNumber: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
  };
  token: string;
  accountNumber: string;
};

export type RpAdminAuthResponse = {
  admin: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  token: string;
};

function signRpToken(payload: { userId: string; role: 'RP_MEMBER' | 'RP_ADMIN'; email?: string; accountNumber?: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as any);
}

export const rpAuthService = {
  async registerMember(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }): Promise<RpMemberAuthResponse> {
    const email = data.email.toLowerCase().trim();
    const existing = await prisma.rpMember.findUnique({ where: { email } });
    if (existing) {
      throw new Error('An account with this email already exists');
    }

    const accountNumber = await generateUniqueAccountNumber();
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const member = await prisma.rpMember.create({
      data: {
        accountNumber,
        password: hashedPassword,
        email,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        phone: data.phone?.trim() || null,
      },
    });

    const displayNumber = formatAccountNumberDisplay(accountNumber);
    try {
      await sendEmail({
        to: email,
        subject: 'Your R&P Global Energies account number',
        text: [
          `Hello ${member.firstName},`,
          '',
          'Welcome to R&P Global Energies.',
          '',
          `Your 10-digit account number is: ${accountNumber}`,
          `(Formatted: ${displayNumber})`,
          '',
          'Use this account number with your password to sign in to the member portal.',
          '',
          'Thank you,',
          'R&P Global Energies',
        ].join('\n'),
      });
    } catch (emailError) {
      console.error('[R&P register] account created but welcome email failed', {
        memberId: member.id,
        email,
        error: emailError,
      });
    }

    const token = signRpToken({
      userId: member.id,
      role: 'RP_MEMBER',
      email: member.email,
      accountNumber: member.accountNumber,
    });

    return {
      member: {
        id: member.id,
        accountNumber: member.accountNumber,
        email: member.email,
        firstName: member.firstName,
        lastName: member.lastName,
        phone: member.phone || undefined,
      },
      token,
      accountNumber: member.accountNumber,
    };
  },

  async loginMember(accountNumber: string, password: string): Promise<RpMemberAuthResponse> {
    const normalized = accountNumber.replace(/\D/g, '');
    if (normalized.length !== 10) {
      throw new Error('Account number must be 10 digits');
    }

    const member = await prisma.rpMember.findUnique({
      where: { accountNumber: normalized },
    });

    if (!member || !member.isActive) {
      throw new Error('Invalid account number or password');
    }

    const valid = await bcrypt.compare(password, member.password);
    if (!valid) {
      throw new Error('Invalid account number or password');
    }

    const token = signRpToken({
      userId: member.id,
      role: 'RP_MEMBER',
      email: member.email,
      accountNumber: member.accountNumber,
    });

    return {
      member: {
        id: member.id,
        accountNumber: member.accountNumber,
        email: member.email,
        firstName: member.firstName,
        lastName: member.lastName,
        phone: member.phone || undefined,
      },
      token,
      accountNumber: member.accountNumber,
    };
  },

  async loginAdmin(email: string, password: string): Promise<RpAdminAuthResponse> {
    const admin = await prisma.rpAdmin.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!admin || !admin.isActive) {
      throw new Error('Invalid email or password');
    }

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      throw new Error('Invalid email or password');
    }

    const token = signRpToken({
      userId: admin.id,
      role: 'RP_ADMIN',
      email: admin.email,
    });

    return {
      admin: {
        id: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
      },
      token,
    };
  },
};
