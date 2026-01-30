import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { UserRole } from '@prisma/client';

const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';

export interface DriverLoginDto {
  email: string;
  password: string;
}

export interface DriverAuthResponse {
  driver: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    photoUrl?: string;
    licenseNumber: string;
    vehicleType: string;
    vehicleNumber: string;
    isAvailable: boolean;
    isActive: boolean;
  };
  token: string;
}

export const driverAuthService = {
  async login(data: DriverLoginDto): Promise<DriverAuthResponse> {
    const { email, password } = data;

    const driver = await prisma.driver.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!driver) {
      throw new Error('Invalid email or password');
    }

    if (!driver.isActive) {
      throw new Error('Account is deactivated');
    }

    if (!driver.password) {
      throw new Error('Driver account is not activated. Please contact admin to set your password.');
    }

    const isValidPassword = await bcrypt.compare(password, driver.password);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    const token = jwt.sign(
      { userId: driver.id, email: driver.email, role: UserRole.DRIVER },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as any
    );

    return {
      driver: {
        id: driver.id,
        email: driver.email,
        firstName: driver.firstName,
        lastName: driver.lastName,
        phone: driver.phone,
        photoUrl: driver.photoUrl || undefined,
        licenseNumber: driver.licenseNumber,
        vehicleType: driver.vehicleType,
        vehicleNumber: driver.vehicleNumber,
        isAvailable: driver.isAvailable,
        isActive: driver.isActive,
      },
      token,
    };
  },

  async activateWithToken(data: { token: string; password: string }) {
    const rawToken = String(data.token || '').trim();
    const password = String(data.password || '');

    if (!rawToken) {
      throw new Error('Invite token is required');
    }
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    let decoded: any;
    try {
      decoded = jwt.verify(rawToken, JWT_SECRET as string);
    } catch {
      throw new Error('Invalid or expired invite token');
    }

    const driverId = decoded?.driverId;
    const purpose = decoded?.purpose;
    if (!driverId || purpose !== 'DRIVER_INVITE') {
      throw new Error('Invalid invite token');
    }

    const existing = await prisma.driver.findUnique({
      where: { id: String(driverId) },
      select: { id: true, isActive: true, password: true },
    });

    if (!existing) {
      throw new Error('Driver not found');
    }
    if (!existing.isActive) {
      throw new Error('Driver account is deactivated');
    }
    // MVP: allow this link to set OR reset password.

    const updated = await prisma.driver.update({
      where: { id: existing.id },
      data: {
        password: await bcrypt.hash(password, 10),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        photoUrl: true,
        licenseNumber: true,
        vehicleType: true,
        vehicleNumber: true,
        isAvailable: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updated;
  },

  async getCurrentDriver(driverId: string) {
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        photoUrl: true,
        licenseNumber: true,
        vehicleType: true,
        vehicleNumber: true,
        isAvailable: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!driver || !driver.isActive) {
      throw new Error('Driver not found or inactive');
    }

    return driver;
  },
};

