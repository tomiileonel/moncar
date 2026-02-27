import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { vehicleController } from '../controllers/vehicle.controller.js';
const router = Router();
// Rutas de Vehículos delegadas al controlador
router.get('/', vehicleController.getAll);
router.post('/', vehicleController.create);
router.put('/:id', authenticateToken, vehicleController.update);
router.delete('/:id', authenticateToken, vehicleController.delete);
export default router;
//# sourceMappingURL=vehicle.routes.js.map