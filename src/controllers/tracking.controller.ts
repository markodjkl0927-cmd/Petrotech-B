import { Request, Response } from 'express';
import { reverseGeocodeLocation } from '../lib/geocoding';

export const trackingController = {
  async reverse(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

      const latRaw = (req.query.lat ?? req.query.latitude) as string | undefined;
      const lngRaw = (req.query.lng ?? req.query.lon ?? req.query.longitude) as string | undefined;

      const latitude = Number(latRaw);
      const longitude = Number(lngRaw);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return res.status(400).json({ error: 'lat/lng are required' });
      }

      const result = await reverseGeocodeLocation(latitude, longitude);
      return res.json({
        place: result?.shortLabel || result?.displayName || null,
        displayName: result?.displayName || null,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to reverse geocode' });
    }
  },
};

