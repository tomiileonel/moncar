import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { InsufficientStockError, InventoryItemNotFoundError, InventoryItemInactiveError } from '../services/inventory.service.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Conflicto de negocio, no un fallo del servidor: el mecánico pidió más
  // repuesto del que hay disponible. 409 porque el estado actual del
  // inventario impide completar la operación tal como fue solicitada.
  if (err instanceof InsufficientStockError) {
    res.status(409).json({ error: err.message });
    return;
  }

  if (err instanceof InventoryItemInactiveError) {
    res.status(409).json({ error: err.message });
    return;
  }

  if (err instanceof InventoryItemNotFoundError) {
    res.status(400).json({ error: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Datos inválidos',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2025: registro no encontrado (update/delete sobre id inexistente)
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Vehículo no encontrado' });
      return;
    }
    console.error('[Prisma error]', err.code, err.message);
    res.status(400).json({ error: 'Error de datos: verificá los valores enviados' });
    return;
  }

  console.error('[Unhandled error]', err);
  res.status(500).json({ error: 'Error interno del servidor' });
}
