import type { Request, Response, NextFunction } from 'express';
import { CRON_SECRET } from '../config.js';
import { prisma } from '../lib/prisma.js';

export async function cleanupInvites(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authorization = req.headers.authorization;
    if (!CRON_SECRET || authorization !== `Bearer ${CRON_SECRET}`) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    const result = await prisma.adminInvite.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { usedAt: { not: null } },
        ],
      },
    });
    res.json({ deletedInvites: result.count });
  } catch (error) {
    next(error);
  }
}
