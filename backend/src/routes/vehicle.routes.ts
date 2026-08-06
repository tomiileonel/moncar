import { Router } from 'express';
import { authenticateToken, optionalAuth, requireRole } from '../middleware/auth.js';
import { clientRateLimiter } from '../middleware/rate-limit.js';
import { vehicleController } from '../controllers/vehicle.controller.js';
import { vehiclePdf } from '../controllers/pdf.controller.js';
import { trackingRateLimiter } from '../middleware/rate-limit.js';

const router = Router();

// Admin routes (auth required)
router.get('/', authenticateToken, vehicleController.getAll);
router.get('/track', trackingRateLimiter, vehicleController.track);
router.get('/:id/pdf', authenticateToken, vehiclePdf);
router.put('/:id', authenticateToken, vehicleController.update);
router.delete('/:id', authenticateToken, requireRole(['OWNER']), vehicleController.delete);

// Explicit admin/client create endpoints
router.post('/admin', authenticateToken, vehicleController.createAdmin);
router.post('/client', clientRateLimiter, vehicleController.createClient);

// Backward compat: dispatches based on token presence
// (frontend still uses POST /api/vehicles until Fase 5)
router.post('/', clientRateLimiter, optionalAuth, vehicleController.createCompat);

export default router;
