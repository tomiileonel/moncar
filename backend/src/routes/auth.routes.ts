import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authLoginRateLimiter, authRegisterRateLimiter } from '../middleware/rate-limit.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
 
const router = Router();
 
// Rutas de Autenticación delegadas al controlador
router.post('/register', authRegisterRateLimiter, authController.register);
router.post('/login', authLoginRateLimiter, authController.login);
 
// Ruta para emitir invitaciones (solo OWNER)
router.post('/invites', authenticateToken, requireRole(['OWNER']), authController.createInvite);
 
export default router;
