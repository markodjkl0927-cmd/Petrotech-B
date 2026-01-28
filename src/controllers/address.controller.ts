import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { geocodeAddress } from '../lib/geocoding';
import { calculateDistance, COMPANY_LOCATION, calculateDeliveryFee } from '../lib/distance';

export const addressController = {
  async getAll(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const addresses = await prisma.address.findMany({
        where: { userId: req.user.userId },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'desc' },
        ],
      });

      res.json({ addresses });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch addresses' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;

      const address = await prisma.address.findFirst({
        where: {
          id,
          userId: req.user.userId,
        },
      });

      if (!address) {
        return res.status(404).json({ error: 'Address not found' });
      }

      res.json({ address });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch address' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { label, street, city, state, zipCode, country, latitude, longitude, instructions, isDefault } = req.body;

      if (!label || !street || !city || !zipCode) {
        return res.status(400).json({
          error: 'Label, street, city, and zipCode are required',
        });
      }

      // If setting as default, unset other defaults
      if (isDefault) {
        await prisma.address.updateMany({
          where: { userId: req.user.userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      // Geocode address if coordinates not provided
      let finalLatitude = latitude ? parseFloat(latitude) : null;
      let finalLongitude = longitude ? parseFloat(longitude) : null;

      if (!finalLatitude || !finalLongitude) {
        const geocoded = await geocodeAddress(street, city, state, zipCode, country || 'US');
        if (geocoded) {
          finalLatitude = geocoded.latitude;
          finalLongitude = geocoded.longitude;
        }
      }

      const address = await prisma.address.create({
        data: {
          userId: req.user.userId,
          label,
          street,
          city,
          state,
          zipCode,
          country: country || 'US',
          latitude: finalLatitude,
          longitude: finalLongitude,
          instructions,
          isDefault: isDefault || false,
        },
      });

      res.status(201).json({ address });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to create address' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      const { label, street, city, state, zipCode, country, latitude, longitude, instructions, isDefault } = req.body;

      // Check if address belongs to user
      const existingAddress = await prisma.address.findFirst({
        where: {
          id,
          userId: req.user.userId,
        },
      });

      if (!existingAddress) {
        return res.status(404).json({ error: 'Address not found' });
      }

      // If setting as default, unset other defaults
      if (isDefault) {
        await prisma.address.updateMany({
          where: { userId: req.user.userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      // Geocode address if coordinates not provided and address changed
      let finalLatitude = latitude ? parseFloat(latitude) : existingAddress.latitude;
      let finalLongitude = longitude ? parseFloat(longitude) : existingAddress.longitude;

      const addressChanged = 
        street !== existingAddress.street ||
        city !== existingAddress.city ||
        state !== existingAddress.state ||
        zipCode !== existingAddress.zipCode;

      if ((!finalLatitude || !finalLongitude) && addressChanged) {
        const geocoded = await geocodeAddress(street, city, state, zipCode, country || existingAddress.country);
        if (geocoded) {
          finalLatitude = geocoded.latitude;
          finalLongitude = geocoded.longitude;
        }
      }

      const address = await prisma.address.update({
        where: { id },
        data: {
          label,
          street,
          city,
          state,
          zipCode,
          country,
          latitude: finalLatitude,
          longitude: finalLongitude,
          instructions,
          isDefault: isDefault !== undefined ? isDefault : existingAddress.isDefault,
        },
      });

      res.json({ address });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update address' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;

      // Check if address belongs to user
      const address = await prisma.address.findFirst({
        where: {
          id,
          userId: req.user.userId,
        },
      });

      if (!address) {
        return res.status(404).json({ error: 'Address not found' });
      }

      await prisma.address.delete({
        where: { id },
      });

      res.json({ message: 'Address deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to delete address' });
    }
  },

  async setDefault(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;

      // Check if address belongs to user
      const address = await prisma.address.findFirst({
        where: {
          id,
          userId: req.user.userId,
        },
      });

      if (!address) {
        return res.status(404).json({ error: 'Address not found' });
      }

      // Unset all defaults
      await prisma.address.updateMany({
        where: { userId: req.user.userId, isDefault: true },
        data: { isDefault: false },
      });

      // Set this as default
      const updatedAddress = await prisma.address.update({
        where: { id },
        data: { isDefault: true },
      });

      res.json({ address: updatedAddress });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to set default address' });
    }
  },

  async calculateDistance(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;

      // Check if address belongs to user
      const address = await prisma.address.findFirst({
        where: {
          id,
          userId: req.user.userId,
        },
      });

      if (!address) {
        return res.status(404).json({ error: 'Address not found' });
      }

      // Check if address has coordinates
      if (!address.latitude || !address.longitude) {
        // Try to geocode the address
        const geocoded = await geocodeAddress(
          address.street,
          address.city,
          address.state || undefined,
          address.zipCode,
          address.country
        );

        if (!geocoded) {
          return res.status(400).json({ 
            error: 'Unable to calculate distance. Address coordinates are missing and geocoding failed.' 
          });
        }

        // Update address with geocoded coordinates
        await prisma.address.update({
          where: { id: address.id },
          data: {
            latitude: geocoded.latitude,
            longitude: geocoded.longitude,
          },
        });

        address.latitude = geocoded.latitude;
        address.longitude = geocoded.longitude;
      }

      // Calculate distance
      const distance = calculateDistance(
        COMPANY_LOCATION.latitude,
        COMPANY_LOCATION.longitude,
        address.latitude!,
        address.longitude!
      );

      // Calculate delivery fee
      const deliveryFee = calculateDeliveryFee(distance);

      res.json({
        distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
        deliveryFee: Math.round(deliveryFee * 100) / 100,
        companyLocation: COMPANY_LOCATION,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to calculate distance' });
    }
  },
};

