import { Request, Response } from 'express';
import { driverAuthService } from '../services/driver-auth.service';

export const driverAuthController = {
  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const result = await driverAuthService.login({ email, password });
      res.json(result);
    } catch (error: any) {
      res.status(401).json({ error: error.message || 'Login failed' });
    }
  },

  // One-time activation via invite token (set initial password)
  async activate(req: Request, res: Response) {
    try {
      const { token, password } = req.body as { token?: string; password?: string };

      if (!token || !password) {
        return res.status(400).json({ error: 'token and password are required' });
      }

      const driver = await driverAuthService.activateWithToken({ token, password });
      res.json({ driver });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Activation failed' });
    }
  },

  async me(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const driver = await driverAuthService.getCurrentDriver(req.user.userId);
      res.json({ driver });
    } catch (error: any) {
      res.status(404).json({ error: error.message || 'Driver not found' });
    }
  },
};

