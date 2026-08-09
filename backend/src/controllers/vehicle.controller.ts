import type { Request, Response, NextFunction } from 'express';
import { VehicleType, VehicleStatus, VehicleSource } from '@prisma/client';
import { z } from 'zod';
import crypto from 'node:crypto';
import type { AuthRequest } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { APP_URL } from '../config.js';
import { notifyVehicleReady } from '../services/notification.service.js';
import { replaceVehicleParts, type VehiclePartInput } from '../services/inventory.service.js';
 
function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}
 
type VehicleRecord = Awaited<ReturnType<typeof prisma.vehicle.create>> & {
  parts?: Array<{ itemId: number; quantity: number; unitCost: unknown }>;
};
 
function serializeVehicle(v: VehicleRecord) {
  return {
    ...v,
    id: v.id.toString(),
    cost_labor: v.cost_labor !== null ? v.cost_labor.toFixed(2) : null,
    cost_parts: v.cost_parts !== null ? v.cost_parts.toFixed(2) : null,
  };
}
 
const vehicleTypeSchema = z.nativeEnum(VehicleType);
const vehicleStatusSchema = z.nativeEnum(VehicleStatus);
const plateSchema = z.string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9 -]{5,12}$/, 'La patente debe tener entre 5 y 12 caracteres');
 
const optionalIntFromString = z
  .string()
  .optional()
  .nullable()
  .transform((val) => {
    if (!val || val.trim() === '') return null;
    const parsed = Number.parseInt(val, 10);
    return Number.isNaN(parsed) ? null : parsed;
  });
 
// Km es obligatorio únicamente en el alta pública de cliente (fase 2 del
// formulario). El panel admin sigue usando optionalIntFromString: un
// mecánico puede cargar un vehículo sin conocer el kilometraje todavía.
const requiredIntFromString = z
  .string()
  .min(1, 'El kilometraje es requerido')
  .transform((val, ctx) => {
    const parsed = Number.parseInt(val, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'El kilometraje debe ser un número positivo' });
      return z.NEVER;
    }
    return parsed;
  });
 
const optionalDecimalFromString = z
  .string()
  .optional()
  .nullable()
  .transform((val) => (val && val.trim() !== '' ? val : null))
  .refine((val) => val === null || !Number.isNaN(Number(val)), {
    message: 'Debe ser un valor numérico válido',
  });
 
const dateFromString = z
  .string()
  .min(1, 'La fecha es requerida')
  .transform((val) => new Date(val))
  .refine((date) => !Number.isNaN(date.getTime()), { message: 'Fecha inválida' });
 
const optionalDateFromString = z
  .string()
  .optional()
  .nullable()
  .transform((val) => (val ? new Date(val) : null))
  .refine((date) => date === null || !Number.isNaN(date.getTime()), { message: 'Fecha inválida' });
 
const partsSchema = z.array(z.object({
  itemId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive().max(1000),
  unitCost: z.string().optional().nullable(),
})).max(50).optional();
 
const clientCreateSchema = z.object({
  owner: z.string().min(1, 'El propietario es requerido'),
  phone: z.string().regex(/^\d{7,15}$/, 'El teléfono debe tener entre 7 y 15 dígitos'),
  plate: plateSchema,
  type: vehicleTypeSchema,
  carname: z.string().min(1, 'La marca es requerida'),
  year: optionalIntFromString,
  km: requiredIntFromString,
  problem: z.string().min(1, 'El problema es requerido'),
});
 
const adminCreateSchema = clientCreateSchema.extend({
  km: optionalIntFromString, // el registro admin puede omitir km; solo el alta de cliente lo exige
  entry: optionalDateFromString,
  exit: optionalDateFromString,
  cost_labor: optionalDecimalFromString,
  cost_parts: optionalDecimalFromString,
  status: vehicleStatusSchema.optional(),
  parts: partsSchema,
});
 
const updateSchema = z.object({
  owner: z.string().min(1, 'El propietario es requerido'),
  phone: z.string().regex(/^\d{7,15}$/, 'El teléfono debe tener entre 7 y 15 dígitos'),
  plate: plateSchema.optional().nullable(),
  type: vehicleTypeSchema,
  carname: z.string().min(1, 'La marca es requerida'),
  year: optionalIntFromString,
  km: optionalIntFromString,
  km_salida: optionalIntFromString,
  entry: dateFromString,
  exit: optionalDateFromString,
  problem: z.string().min(1, 'El problema es requerido'),
  cost_labor: optionalDecimalFromString,
  cost_parts: optionalDecimalFromString,
  status: vehicleStatusSchema.optional(),
  source: z.nativeEnum(VehicleSource).optional(),
  parts: partsSchema,
});
 
function toPartInputs(parts: z.infer<typeof partsSchema>): VehiclePartInput[] {
  return (parts ?? []).map((part) => ({
    itemId: part.itemId,
    quantity: part.quantity,
    unitCost: part.unitCost ?? null,
  }));
}
 
async function safelyNotifyReady(vehicle: VehicleRecord, previousStatus: VehicleStatus): Promise<void> {
  try {
    await notifyVehicleReady(vehicle, previousStatus);
  } catch (error) {
    console.error('[Notification error]', error);
  }
}
 
export const vehicleController = {
  getAll: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const vehicles = await prisma.vehicle.findMany({
        where: { deleted: false },
        orderBy: { createdAt: 'desc' },
        include: { parts: { select: { itemId: true, quantity: true, unitCost: true } } },
      });
      res.json(vehicles.map(serializeVehicle));
    } catch (error) {
      next(error);
    }
  },
 
  createClient: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = clientCreateSchema.parse(req.body);
      const vehicle = await prisma.vehicle.create({
        data: {
          owner: data.owner,
          phone: data.phone,
          plate: data.plate,
          type: data.type,
          carname: data.carname,
          year: data.year,
          km: data.km,
          problem: data.problem,
          entry: new Date(),
          source: VehicleSource.CLIENT,
          status: VehicleStatus.PENDIENTE,
        },
      });
      res.status(201).json(serializeVehicle(vehicle));
    } catch (error) {
      next(error);
    }
  },
 
  createAdmin: async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = adminCreateSchema.parse(req.body);
      const vehicle = await prisma.$transaction(async (tx) => {
        const created = await tx.vehicle.create({
          data: {
            owner: data.owner,
            phone: data.phone,
            plate: data.plate,
            type: data.type,
            carname: data.carname,
            year: data.year,
            km: data.km,
            problem: data.problem,
            entry: data.entry ?? new Date(),
            exit: data.exit,
            cost_labor: data.cost_labor,
            cost_parts: data.cost_parts,
            source: VehicleSource.ADMIN,
            status: data.status ?? VehicleStatus.PENDIENTE,
          },
        });
        if (data.parts) await replaceVehicleParts(tx, created.id, toPartInputs(data.parts));
        return created;
      });
      await safelyNotifyReady(vehicle, VehicleStatus.PENDIENTE);
      res.status(201).json(serializeVehicle(vehicle));
    } catch (error) {
      next(error);
    }
  },
 
  createCompat: async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (req.admin) return vehicleController.createAdmin(req, res, next);
    return vehicleController.createClient(req as Request, res, next);
  },
 
  track: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const plate = plateSchema.parse(req.query.plate);
      const phone = z.string().regex(/^\d{7,15}$/).parse(req.query.phone);
      const vehicle = await prisma.vehicle.findFirst({
        where: { plate, phone, deleted: false },
        select: {
          plate: true, carname: true, type: true, status: true,
          entry: true, exit: true, updatedAt: true, cost_labor: true, cost_parts: true,
        },
      });
 
      if (!vehicle) {
        res.status(404).json({ error: 'No encontramos un vehículo con esos datos' });
        return;
      }
 
      const isReady = vehicle.status === VehicleStatus.LISTO;
      res.json({
        plate: vehicle.plate,
        carname: vehicle.carname,
        type: vehicle.type,
        status: vehicle.status,
        entry: vehicle.entry,
        exit: vehicle.exit,
        updatedAt: vehicle.updatedAt,
        ...(isReady ? {
          cost_labor: vehicle.cost_labor?.toFixed(2) ?? null,
          cost_parts: vehicle.cost_parts?.toFixed(2) ?? null,
        } : {}),
      });
    } catch (error) {
      next(error);
    }
  },
 
  update: async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const data = updateSchema.parse(req.body);
      const vehicleId = Number.parseInt(id as string, 10);
      const existingVehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
 
      if (!existingVehicle) {
        res.status(404).json({ error: 'Vehículo no encontrado' });
        return;
      }
 
      if (req.admin && req.admin.role === 'MECHANIC' && existingVehicle.status === VehicleStatus.LISTO) {
        res.status(403).json({ error: 'No tienes permisos para modificar un vehículo que ya está LISTO' });
        return;
      }
 
      const updatedVehicle = await prisma.$transaction(async (tx) => {
        const updated = await tx.vehicle.update({
          where: { id: vehicleId },
          data: {
            owner: data.owner,
            phone: data.phone,
            ...(data.plate !== undefined ? { plate: data.plate } : {}),
            type: data.type,
            carname: data.carname,
            year: data.year,
            km: data.km,
            km_salida: data.km_salida,
            entry: data.entry,
            exit: data.exit,
            problem: data.problem,
            cost_labor: data.cost_labor,
            cost_parts: data.cost_parts,
            ...(data.status ? { status: data.status } : {}),
            ...(data.source ? { source: data.source } : {}),
          },
        });
        if (data.parts) await replaceVehicleParts(tx, vehicleId, toPartInputs(data.parts));
        return updated;
      });
 
      await safelyNotifyReady(updatedVehicle, existingVehicle.status);
      res.json(serializeVehicle(updatedVehicle));
    } catch (error) {
      next(error);
    }
  },
 
  delete: async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await prisma.vehicle.update({
        where: { id: Number.parseInt(id as string, 10) },
        data: { deleted: true },
      });
      res.json({ message: 'Vehículo eliminado con éxito' });
    } catch (error) {
      next(error);
    }
  },
 
  // Genera (o reutiliza, si ya existe uno vigente) el token QR de la patente
  // asociada al vehículo :id. Solo personal autenticado — el token crudo
  // solo se devuelve acá, nunca vuelve a mostrarse una vez generado.
  getOrCreateQr: async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const vehicleId = Number.parseInt(req.params.id as string, 10);
      if (Number.isNaN(vehicleId)) {
        res.status(400).json({ error: 'ID inválido' });
        return;
      }
 
      const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { plate: true } });
      if (!vehicle || !vehicle.plate) {
        res.status(404).json({ error: 'Vehículo no encontrado o sin patente registrada' });
        return;
      }
 
      const existing = await prisma.vehicleQrToken.findFirst({
        where: { plate: vehicle.plate, revokedAt: null },
      });
 
      if (existing) {
        res.json({
          exists: true,
          plate: vehicle.plate,
          createdAt: existing.createdAt,
          message: 'Ya existe un QR vigente para esta patente. Revocalo para generar uno nuevo.',
        });
        return;
      }
 
      const rawToken = crypto.randomBytes(24).toString('base64url');
      await prisma.vehicleQrToken.create({
        data: { token: hashToken(rawToken), plate: vehicle.plate },
      });
 
      res.status(201).json({
        exists: false,
        plate: vehicle.plate,
        historyUrl: `${APP_URL}/historial.html?token=${rawToken}`,
      });
    } catch (error) {
      next(error);
    }
  },
 
  revokeQr: async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const vehicleId = Number.parseInt(req.params.id as string, 10);
      const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { plate: true } });
      if (!vehicle || !vehicle.plate) {
        res.status(404).json({ error: 'Vehículo no encontrado' });
        return;
      }
      await prisma.vehicleQrToken.updateMany({
        where: { plate: vehicle.plate, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
 
  // Historial completo público de una patente, vía token de QR. Sin JWT:
  // la seguridad depende de que el token sea impredecible (192 bits) y de
  // que nunca se muestre la patente ni el token en texto plano fuera del
  // panel admin. No expone teléfono completo ni costos de otros vehículos.
  history: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawToken = z.string().min(1).parse(req.query.token);
      const tokenHash = hashToken(rawToken);
 
      const qrToken = await prisma.vehicleQrToken.findUnique({ where: { token: tokenHash } });
      if (!qrToken || qrToken.revokedAt) {
        res.status(404).json({ error: 'Enlace inválido o revocado' });
        return;
      }
 
      const visits = await prisma.vehicle.findMany({
        where: { plate: qrToken.plate, deleted: false },
        orderBy: { entry: 'desc' },
        select: {
          id: true, carname: true, type: true, year: true, km: true, km_salida: true,
          entry: true, exit: true, problem: true, status: true, cost_labor: true, cost_parts: true,
          parts: { select: { quantity: true, item: { select: { name: true, unit: true } } } },
        },
      });
 
      res.json({
        plate: qrToken.plate,
        visits: visits.map((v) => ({
          id: v.id.toString(),
          carname: v.carname,
          type: v.type,
          year: v.year,
          km: v.km,
          km_salida: v.km_salida,
          entry: v.entry,
          exit: v.exit,
          problem: v.problem,
          status: v.status,
          ...(v.status === VehicleStatus.LISTO ? {
            cost_labor: v.cost_labor?.toFixed(2) ?? null,
            cost_parts: v.cost_parts?.toFixed(2) ?? null,
          } : {}),
          parts: v.parts.map((p) => ({ name: p.item.name, unit: p.item.unit, quantity: p.quantity })),
        })),
      });
    } catch (error) {
      next(error);
    }
  },
};
