import type { AuthRequest } from '../middleware/auth.js';
import type { Request, Response, NextFunction } from 'express';
import { StockMovementType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import {
  InsufficientStockError,
  InventoryItemNotFoundError,
  InventoryItemInactiveError,
} from '../services/inventory.service.js';
 
const itemSchema = z.object({
  name: z.string().trim().min(2, 'El nombre es obligatorio'),
  sku: z.string().trim().max(64).optional().nullable(),
  unit: z.string().trim().min(1).max(24).default('unidad'),
  minimumStock: z.coerce.number().int().min(0).max(1_000_000).default(0),
});
 
const adjustSchema = z.object({
  type: z.nativeEnum(StockMovementType),
  quantity: z.coerce.number().int().positive().max(1_000_000),
  note: z.string().trim().max(255).optional().nullable(),
});
 
function parseId(value: string): number | null {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}
 
export const inventoryController = {
  list: async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const items = await prisma.inventoryItem.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
      });
      res.json(items);
    } catch (error) {
      next(error);
    }
  },
 
  alerts: async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const items = await prisma.inventoryItem.findMany({ where: { active: true }, orderBy: { quantity: 'asc' } });
      res.json(items.filter((item) => item.quantity <= item.minimumStock));
    } catch (error) {
      next(error);
    }
  },
 
  create: async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = itemSchema.parse(req.body);
      const item = await prisma.inventoryItem.create({ data });
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  },
 
  update: async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseId(req.params.id as string);
      if (!id) {
        res.status(400).json({ error: 'Identificador de repuesto inválido' });
        return;
      }
      const data = itemSchema.parse(req.body);
      const item = await prisma.inventoryItem.update({ where: { id }, data });
      res.json(item);
    } catch (error) {
      next(error);
    }
  },
 
  archive: async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseId(req.params.id as string);
      if (!id) {
        res.status(400).json({ error: 'Identificador de repuesto inválido' });
        return;
      }
      await prisma.inventoryItem.update({ where: { id }, data: { active: false } });
      res.json({ message: 'Repuesto archivado' });
    } catch (error) {
      next(error);
    }
  },
 
  adjust: async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseId(req.params.id as string);
      if (!id) {
        res.status(400).json({ error: 'Identificador de repuesto inválido' });
        return;
      }
      const data = adjustSchema.parse(req.body);
 
      const item = await prisma.$transaction(async (tx) => {
        const current = await tx.inventoryItem.findUnique({ where: { id } });
        if (!current) throw new InventoryItemNotFoundError(id);
        if (!current.active) throw new InventoryItemInactiveError(id);
 
        let delta = data.quantity;
        let movementType = data.type;
        if (data.type === StockMovementType.SALIDA) delta = -data.quantity;
        if (data.type === StockMovementType.AJUSTE) {
          delta = data.quantity - current.quantity;
          movementType = StockMovementType.AJUSTE;
        }
 
        if (delta < 0 && current.quantity < Math.abs(delta)) {
          throw new InsufficientStockError(current.name);
        }
 
        // updateMany condicional: aunque ya validamos `current` arriba, esto
        // cierra la ventana TOCTOU entre el findUnique y el update si dos
        // ajustes concurrentes llegan sobre el mismo item — el segundo que
        // intente decrementar por debajo de 0 falla limpio, no en negativo.
        const guardedWhere =
          delta < 0
            ? { id, active: true, quantity: { gte: Math.abs(delta) } }
            : { id, active: true };
 
        const updated = await tx.inventoryItem.updateMany({
          where: guardedWhere,
          data: { quantity: { increment: delta } },
        });
        if (updated.count !== 1) throw new InsufficientStockError(current.name);
 
        if (delta !== 0) {
          await tx.stockMovement.create({
            data: {
              itemId: id,
              type: movementType,
              quantity: Math.abs(delta),
              note: data.note ?? (data.type === StockMovementType.AJUSTE ? 'Ajuste de inventario' : null),
            },
          });
        }
 
        return tx.inventoryItem.findUniqueOrThrow({ where: { id } });
      });
 
      res.json(item);
    } catch (error) {
      next(error);
    }
  },
 
  movements: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseId(req.params.id as string);
      if (!id) {
        res.status(400).json({ error: 'Identificador de repuesto inválido' });
        return;
      }
      const movements = await prisma.stockMovement.findMany({
        where: { itemId: id },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      res.json(movements);
    } catch (error) {
      next(error);
    }
  },
};
