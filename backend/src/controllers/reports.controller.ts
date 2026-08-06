import type { Response, NextFunction } from 'express';
import { VehicleStatus, Prisma } from '@prisma/client';
import type { AuthRequest } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

/**
 * GET /api/admin/reports/revenue
 * Protegido con requireRole(['OWNER']) en el router.
 *
 * El ingreso se reconoce por `entry` (fecha en que el vehículo entra al
 * taller) — decisión de negocio confirmada. Como consecuencia, `currentMonth`
 * NO es un total cerrado: un vehículo que entró este mes y sigue PENDIENTE
 * o EN_REPARACION no se cuenta todavía, y se sumará retroactivamente al mes
 * de su `entry` (no al mes en que se termine) recién cuando pase a LISTO.
 * Por eso devolvemos también `currentMonthPending`, para que el frontend
 * pueda mostrar "facturado" vs. "en curso, no incluido" en vez de un único
 * número que parezca definitivo sin serlo.
 */
export async function getRevenueReport(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Suma con Prisma.Decimal, no con Number(): evita error acumulado de
    // floats IEEE-754 al agregar decenas de montos DECIMAL(12,2) en un
    // reporte financiero. toFixed(2) de Decimal es exacto; el de Number no.
    const toTotal = (sum: { cost_labor: Prisma.Decimal | null; cost_parts: Prisma.Decimal | null }): string => {
      const labor = sum.cost_labor ?? new Prisma.Decimal(0);
      const parts = sum.cost_parts ?? new Prisma.Decimal(0);
      return labor.plus(parts).toFixed(2);
    };

    const [thisMonthDone, lastMonthDone, thisMonthPending] = await Promise.all([
      prisma.vehicle.aggregate({
        where: {
          deleted: false,
          status: VehicleStatus.LISTO,
          entry: { gte: startOfThisMonth, lt: startOfNextMonth },
        },
        _sum: { cost_labor: true, cost_parts: true },
      }),
      prisma.vehicle.aggregate({
        where: {
          deleted: false,
          status: VehicleStatus.LISTO,
          entry: { gte: startOfLastMonth, lt: startOfThisMonth },
        },
        _sum: { cost_labor: true, cost_parts: true },
      }),
      prisma.vehicle.aggregate({
        where: {
          deleted: false,
          status: { in: [VehicleStatus.PENDIENTE, VehicleStatus.EN_REPARACION] },
          entry: { gte: startOfThisMonth, lt: startOfNextMonth },
        },
        _sum: { cost_labor: true, cost_parts: true },
      }),
    ]);

    res.json({
      currentMonth: toTotal(thisMonthDone._sum),
      previousMonth: toTotal(lastMonthDone._sum),
      currentMonthPending: toTotal(thisMonthPending._sum),
    });
  } catch (error) {
    next(error);
  }
}
