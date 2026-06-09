import { Request, Response } from 'express';
import { rpAuthService } from '../services/rp-auth.service';

export const rpAuthController = {
  async register(req: Request, res: Response) {
    try {
      const { email, password, firstName, lastName, phone } = req.body;
      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ error: 'Email, password, first name, and last name are required' });
      }
      if (String(password).length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      const result = await rpAuthService.registerMember({
        email,
        password,
        firstName,
        lastName,
        phone,
      });
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Registration failed' });
    }
  },

  async login(req: Request, res: Response) {
    try {
      const { accountNumber, password } = req.body;
      if (!accountNumber || !password) {
        return res.status(400).json({ error: 'Account number and password are required' });
      }
      const result = await rpAuthService.loginMember(accountNumber, password);
      res.json(result);
    } catch (error: any) {
      res.status(401).json({ error: error.message || 'Login failed' });
    }
  },

  async adminLogin(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }
      const result = await rpAuthService.loginAdmin(email, password);
      res.json(result);
    } catch (error: any) {
      res.status(401).json({ error: error.message || 'Login failed' });
    }
  },

  async recoverAccount(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }
      const result = await rpAuthService.recoverAccountNumber(email);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Request failed' });
    }
  },

  async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }
      const result = await rpAuthService.requestPasswordReset(email);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Request failed' });
    }
  },

  async resetPassword(req: Request, res: Response) {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ error: 'Token and new password are required' });
      }
      if (String(password).length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      const result = await rpAuthService.resetPassword(token, password);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Password reset failed' });
    }
  },
};
