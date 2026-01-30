import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { productController } from '../controllers/product.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize('ADMIN'));

// Dashboard
router.get('/dashboard/stats', adminController.getDashboardStats);

// Products (admin management)
router.post('/products', productController.create);
router.put('/products/:id', productController.update);
router.delete('/products/:id', productController.delete);

// Orders
router.get('/orders', adminController.getAllOrders);
router.get('/orders/:id', adminController.getOrderById);
router.put('/orders/:id/status', adminController.updateOrderStatus);
router.put('/orders/:id/assign-driver', adminController.assignDriver);

// EV Charging Orders
router.get('/charging-orders', adminController.getAllChargingOrders);
router.put('/charging-orders/:id/status', adminController.updateChargingOrderStatus);
router.put('/charging-orders/:id/assign-driver', adminController.assignChargingOrderDriver);

// Drivers
router.get('/drivers', adminController.getAllDrivers);
router.get('/drivers/available', adminController.getAvailableDrivers);
router.post('/drivers', adminController.createDriver);
router.put('/drivers/:id', adminController.updateDriver);
router.delete('/drivers/:id', adminController.deleteDriver);

// Customers
router.get('/customers', adminController.getAllCustomers);
router.put('/customers/:id', adminController.updateCustomer);
router.delete('/customers/:id', adminController.deleteCustomer);

export default router;
