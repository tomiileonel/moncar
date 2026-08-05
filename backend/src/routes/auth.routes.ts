import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authLoginRateLimiter, authRegisterRateLimiter } from '../middleware/rate-limit.js';

const router = Router();

// Rutas de Autenticación delegadas al controlador
router.post('/register', authRegisterRateLimiter, authController.register);
router.post('/login', authLoginRateLimiter, authController.login);

export default router;
