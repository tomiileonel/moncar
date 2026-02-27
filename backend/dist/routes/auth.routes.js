import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
const router = Router();
// Rutas de Autenticación delegadas al controlador
router.post('/register', authController.register);
router.post('/login', authController.login);
export default router;
//# sourceMappingURL=auth.routes.js.map