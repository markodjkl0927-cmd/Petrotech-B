import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { driverController } from '../controllers/driver.controller';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dest = path.join(process.cwd(), 'uploads', 'drivers');
      fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    },
    filename: (req, file, cb) => {
      const extFromName = path.extname(file.originalname || '').toLowerCase();
      const extFromMime = file.mimetype?.includes('/') ? `.${file.mimetype.split('/')[1]}` : '';
      const ext = extFromName || extFromMime || '.jpg';
      const driverId = (req as any).user?.userId || 'driver';
      cb(null, `${driverId}-${Date.now()}${ext}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (!file.mimetype?.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    return cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// All driver routes require authentication and DRIVER role
router.use(authenticate);
router.use(authorize('DRIVER'));

// Profile
router.get('/me', driverController.getMe);
router.put('/me', driverController.updateMe);
router.post('/me/photo', upload.single('photo'), driverController.uploadPhoto);

// Live location (MVP)
router.post('/location', driverController.updateLocation);

// Assigned fuel orders
router.get('/orders', driverController.getAssignedFuelOrders);
router.get('/orders/:id', driverController.getFuelOrderById);
router.patch('/orders/:id/status', driverController.updateFuelOrderStatus);

// Assigned EV charging orders
router.get('/charging-orders', driverController.getAssignedChargingOrders);
router.get('/charging-orders/:id', driverController.getChargingOrderById);
router.patch('/charging-orders/:id/status', driverController.updateChargingOrderStatus);

export default router;

