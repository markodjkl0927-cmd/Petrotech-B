import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import productRoutes from './product.routes';
import addressRoutes from './address.routes';
import orderRoutes from './order.routes';
import adminRoutes from './admin.routes';
import paymentRoutes from './payment.routes';
import chargingRoutes from './charging.routes';
import carRoutes from './car.routes';
import driverAuthRoutes from './driver-auth.routes';
import driverRoutes from './driver.routes';
import trackingRoutes from './tracking.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/products', productRoutes);
router.use('/addresses', addressRoutes);
router.use('/orders', orderRoutes);
router.use('/admin', adminRoutes);
router.use('/payments', paymentRoutes);
router.use('/charging', chargingRoutes);
router.use('/cars', carRoutes);
router.use('/driver/auth', driverAuthRoutes);
router.use('/driver', driverRoutes);
router.use('/tracking', trackingRoutes);

export default router;

