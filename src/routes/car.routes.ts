import { Router } from 'express';
import { carController } from '../controllers/car.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all cars
router.get('/', carController.getCars);

// Get car by ID
router.get('/:id', carController.getCarById);

// Create car
router.post('/', carController.create);

// Update car
router.put('/:id', carController.update);

// Delete car
router.delete('/:id', carController.delete);

export default router;
