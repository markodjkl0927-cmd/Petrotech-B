import { Router } from 'express';
import { addressController } from '../controllers/address.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate); // All routes require authentication

router.get('/', addressController.getAll);
router.get('/:id', addressController.getById);
router.get('/:id/distance', addressController.calculateDistance);
router.post('/', addressController.create);
router.put('/:id', addressController.update);
router.delete('/:id', addressController.delete);
router.put('/:id/default', addressController.setDefault);

export default router;

