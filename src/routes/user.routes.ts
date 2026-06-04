import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate); // All routes require authentication

router.get('/me', userController.getProfile);
router.put('/me', userController.updateProfile);
router.put('/me/password', userController.changePassword);
router.post('/me/push-token', userController.registerPushToken);
router.get('/me/notifications', userController.getNotifications);
router.patch('/me/notifications/read-all', userController.markAllNotificationsRead);
router.patch('/me/notifications/:id/read', userController.markNotificationRead);

export default router;

