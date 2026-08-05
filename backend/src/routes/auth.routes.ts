import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authRateLimiter } from '../middleware/rate-limit.js';

const router = Router();

// Rutas de Autenticación delegadas al controlador
router.post('/register', authRateLimiter, authController.register);
router.post('/login', authRateLimiter, authController.login);

export default router;
