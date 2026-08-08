import type { Request, Response, NextFunction } from 'express';
import { VehicleType, VehicleStatus, VehicleSource } from '@prisma/client';
import { z } from 'zod';
import type { AuthRequest } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { notifyVehicleReady } from '../services/notification.service.js';
import { replaceVehicleParts, type VehiclePartInput } from '../services/inventory.service.js';

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
  km: optionalIntFromString,
  problem: z.string().min(1, 'El problema es requerido'),
});

const adminCreateSchema = clientCreateSchema.extend({
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
    // A notification provider must never make a vehicle update fail.
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
          plate: true,
          carname: true,
          type: true,
          status: true,
          entry: true,
          exit: true,
          updatedAt: true,
          cost_labor: true,
          cost_parts: true,
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
};
