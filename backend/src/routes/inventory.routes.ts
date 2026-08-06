import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { inventoryController } from '../controllers/inventory.controller.js';

const router = Router();
router.use(authenticateToken);

router.get('/', inventoryController.list);
router.get('/alerts', requireRole(['OWNER']), inventoryController.alerts);
router.get('/:id/movements', inventoryController.movements);
router.post('/', requireRole(['OWNER']), inventoryController.create);
router.put('/:id', requireRole(['OWNER']), inventoryController.update);
router.delete('/:id', requireRole(['OWNER']), inventoryController.archive);
router.post('/:id/adjust', requireRole(['OWNER']), inventoryController.adjust);

export default router;
