import { Router } from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { clientRateLimiter } from '../middleware/rate-limit.js';
import { vehicleController } from '../controllers/vehicle.controller.js';

const router = Router();

// Admin routes (auth required)
router.get('/', authenticateToken, vehicleController.getAll);
router.put('/:id', authenticateToken, vehicleController.update);
router.delete('/:id', authenticateToken, vehicleController.delete);

// Explicit admin/client create endpoints
router.post('/admin', authenticateToken, vehicleController.createAdmin);
router.post('/client', clientRateLimiter, vehicleController.createClient);

// Backward compat: dispatches based on token presence
// (frontend still uses POST /api/vehicles until Fase 5)
router.post('/', optionalAuth, vehicleController.createCompat);

export default router;
