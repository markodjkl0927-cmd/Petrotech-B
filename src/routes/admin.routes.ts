import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize('ADMIN'));

// Dashboard
router.get('/dashboard/stats', adminController.getDashboardStats);

// Orders
router.get('/orders', adminController.getAllOrders);
router.get('/orders/:id', adminController.getOrderById);
router.put('/orders/:id/status', adminController.updateOrderStatus);
router.put('/orders/:id/assign-driver', adminController.assignDriver);

// Drivers
router.get('/drivers', adminController.getAllDrivers);
router.get('/drivers/available', adminController.getAvailableDrivers);
router.post('/drivers', adminController.createDriver);
router.put('/drivers/:id', adminController.updateDriver);

// Customers
router.get('/customers', adminController.getAllCustomers);

export default router;
