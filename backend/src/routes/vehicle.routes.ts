import { Router } from 'express';
import { authenticateToken, optionalAuth, requireRole } from '../middleware/auth.js';
import { clientRateLimiter, trackingRateLimiter } from '../middleware/rate-limit.js';
import { vehicleController } from '../controllers/vehicle.controller.js';
import { vehiclePdf } from '../controllers/pdf.controller.js';
 
const router = Router();
 
// Admin routes (auth required)
router.get('/', authenticateToken, vehicleController.getAll);
router.get('/track', trackingRateLimiter, vehicleController.track);
 
// Historial público por QR — mismo nivel de exposición que /track (sin JWT,
// protegido por secreto impredecible en vez de credenciales de sesión).
// Rate-limited igual que track para frenar intentos de fuerza bruta del token.
router.get('/history', trackingRateLimiter, vehicleController.history);
 
router.get('/:id/pdf', authenticateToken, vehiclePdf);
router.put('/:id', authenticateToken, vehicleController.update);
router.delete('/:id', authenticateToken, requireRole(['OWNER']), vehicleController.delete);
 
// Gestión del QR de historial — cualquier admin autenticado puede generar o
// revocar, mismo nivel de acceso que el resto de operaciones sobre Vehicle.
router.post('/:id/qr', authenticateToken, vehicleController.getOrCreateQr);
router.delete('/:id/qr', authenticateToken, vehicleController.revokeQr);
 
// Explicit admin/client create endpoints
router.post('/admin', authenticateToken, vehicleController.createAdmin);
router.post('/client', clientRateLimiter, vehicleController.createClient);
 
// Backward compat: dispatches based on token presence
router.post('/', clientRateLimiter, optionalAuth, vehicleController.createCompat);
 
export default router;
