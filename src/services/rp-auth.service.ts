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

const RECOVERY_GENERIC_MESSAGE =
  'If an account exists for that email, we sent instructions. Check your inbox and spam folder.';

function signRpToken(payload: { userId: string; role: 'RP_MEMBER' | 'RP_ADMIN'; email?: string; accountNumber?: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as any);
}

function getPortalUrl(): string {
  return (process.env.RP_PORTAL_URL || process.env.FRONTEND_URL || 'https://randpglobalenergies.com').replace(
    /\/$/,
    ''
  );
}

function signPasswordResetToken(memberId: string, email: string): string {
  return jwt.sign({ userId: memberId, email, purpose: 'RP_PASSWORD_RESET' }, JWT_SECRET, { expiresIn: '1h' } as any);
}

async function sendRecoveryEmail(to: string, subject: string, lines: string[]): Promise<void> {
  try {
    await sendEmail({ to, subject, text: lines.join('\n') });
  } catch (emailError) {
    console.error('[R&P recovery] email failed', { to, subject, error: emailError });
  }
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

  async recoverAccountNumber(email: string): Promise<{ message: string }> {
    const normalized = email.toLowerCase().trim();
    const member = await prisma.rpMember.findUnique({
      where: { email: normalized },
    });

    if (member?.isActive) {
      const displayNumber = formatAccountNumberDisplay(member.accountNumber);
      await sendRecoveryEmail(normalized, 'Your R&P Global Energies account number', [
        `Hello ${member.firstName},`,
        '',
        'You requested a reminder of your member account number.',
        '',
        `Your 10-digit account number is: ${member.accountNumber}`,
        `(Formatted: ${displayNumber})`,
        '',
        'Use this account number with your password to sign in at the member portal.',
        '',
        'If you did not request this, you can ignore this email.',
        '',
        'Thank you,',
        'R&P Global Energies',
      ]);
    }

    return { message: RECOVERY_GENERIC_MESSAGE };
  },

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const normalized = email.toLowerCase().trim();
    const member = await prisma.rpMember.findUnique({
      where: { email: normalized },
    });

    if (member?.isActive) {
      const token = signPasswordResetToken(member.id, member.email);
      const resetUrl = `${getPortalUrl()}/reset-password?token=${encodeURIComponent(token)}`;
      await sendRecoveryEmail(normalized, 'Reset your R&P Global Energies password', [
        `Hello ${member.firstName},`,
        '',
        'You requested to reset your member portal password.',
        '',
        'Open this link to choose a new password (valid for 1 hour):',
        resetUrl,
        '',
        'If you did not request this, you can ignore this email.',
        '',
        'Thank you,',
        'R&P Global Energies',
      ]);
    }

    return { message: RECOVERY_GENERIC_MESSAGE };
  },

  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    if (!token?.trim()) {
      throw new Error('Reset token is required');
    }
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    let decoded: jwt.JwtPayload;
    try {
      decoded = jwt.verify(token.trim(), JWT_SECRET) as jwt.JwtPayload;
    } catch {
      throw new Error('Invalid or expired reset link. Please request a new one.');
    }

    if (decoded.purpose !== 'RP_PASSWORD_RESET' || !decoded.userId) {
      throw new Error('Invalid or expired reset link. Please request a new one.');
    }

    const member = await prisma.rpMember.findUnique({
      where: { id: String(decoded.userId) },
    });

    if (!member || !member.isActive) {
      throw new Error('Invalid or expired reset link. Please request a new one.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.rpMember.update({
      where: { id: member.id },
      data: { password: hashedPassword },
    });

    return { message: 'Password updated. You can sign in with your account number and new password.' };
  },
};
