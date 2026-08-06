import { Router } from 'express';
import { getRevenueReport } from '../controllers/reports.controller.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

// Todas las rutas de reportes requieren rol de OWNER
router.use(authenticateToken, requireRole(['OWNER']));

router.get('/revenue', getRevenueReport);

export default router;
