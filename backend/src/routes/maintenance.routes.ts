import { Router } from 'express';
import { cleanupInvites } from '../controllers/maintenance.controller.js';

const router = Router();
router.get('/cron/cleanup-invites', cleanupInvites);

export default router;
