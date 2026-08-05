import type { Request, Response, NextFunction } from 'express';
import { VehicleType, VehicleStatus, VehicleSource } from '@prisma/client';
import { z } from 'zod';
import type { AuthRequest } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

// Prisma.Decimal.toJSON() delega en toString(), que recorta ceros finales
// (15000.10 -> "15000.1"). Para montos monetarios fijamos 2 decimales acá,
// en el backend, en vez de depender de que cada consumidor formatee bien.
type VehicleRecord = Awaited<ReturnType<typeof prisma.vehicle.create>>;

function serializeVehicle(v: VehicleRecord) {
  return {
    ...v,
    id: v.id.toString(),
    cost_labor: v.cost_labor !== null ? v.cost_labor.toFixed(2) : null,
    cost_parts: v.cost_parts !== null ? v.cost_parts.toFixed(2) : null,
  };
}

// Reutilizamos los enums generados por Prisma como fuente única de verdad:
// si el schema cambia, z.nativeEnum se actualiza solo en el próximo `prisma generate`.
const vehicleTypeSchema = z.nativeEnum(VehicleType);
const vehicleStatusSchema = z.nativeEnum(VehicleStatus);

// Acepta "123", "" o undefined -> number | null. Nunca deja pasar un string a Prisma.
const optionalIntFromString = z
  .string()
  .optional()
  .nullable()
  .transform((val) => {
    if (!val || val.trim() === '') return null;
    const parsed = Number.parseInt(val, 10);
    return Number.isNaN(parsed) ? null : parsed;
  });

// Idem para Decimal(12,2) — Prisma acepta string para Decimal, pero validamos formato numérico.
const optionalDecimalFromString = z
  .string()
  .optional()
  .nullable()
  .transform((val) => (val && val.trim() !== '' ? val : null))
  .refine((val) => val === null || !Number.isNaN(Number(val)), {
    message: 'Debe ser un valor numérico válido',
  });

// ISO date string -> Date. Acepta "2026-08-05" o ISO completo.
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

const clientCreateSchema = z.object({
  owner: z.string().min(1, 'El propietario es requerido'),
  phone: z.string().regex(/^\d{7,15}$/, 'El teléfono debe tener entre 7 y 15 dígitos'),
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
});

const updateSchema = z.object({
  owner: z.string().min(1, 'El propietario es requerido'),
  phone: z.string().regex(/^\d{7,15}$/, 'El teléfono debe tener entre 7 y 15 dígitos'),
  type: vehicleTypeSchema,
  carname: z.string().min(1, 'La marca es requerida'),
  year: optionalIntFromString,
  km: optionalIntFromString,
  entry: dateFromString,
  exit: optionalDateFromString,
  problem: z.string().min(1, 'El problema es requerido'),
  cost_labor: optionalDecimalFromString,
  cost_parts: optionalDecimalFromString,
  status: vehicleStatusSchema.optional(),
  source: z.nativeEnum(VehicleSource).optional(),
});

export const vehicleController = {
  getAll: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const vehicles = await prisma.vehicle.findMany({
        where: { deleted: false },
        orderBy: { createdAt: 'desc' },
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
      const vehicle = await prisma.vehicle.create({
        data: {
          owner: data.owner,
          phone: data.phone,
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
      res.status(201).json(serializeVehicle(vehicle));
    } catch (error) {
      next(error);
    }
  },

  createCompat: async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (req.admin) {
      return vehicleController.createAdmin(req, res, next);
    }
    return vehicleController.createClient(req as Request, res, next);
  },

  update: async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const data = updateSchema.parse(req.body);

      const updatedVehicle = await prisma.vehicle.update({
        where: { id: Number.parseInt(id as string, 10) },
        data: {
          owner: data.owner,
          phone: data.phone,
          type: data.type,
          carname: data.carname,
          year: data.year,
          km: data.km,
          entry: data.entry,
          exit: data.exit,
          problem: data.problem,
          cost_labor: data.cost_labor,
          cost_parts: data.cost_parts,
          ...(data.status ? { status: data.status } : {}),
          ...(data.source ? { source: data.source } : {}),
        },
      });

      res.json(serializeVehicle(updatedVehicle));
    } catch (error) {
      next(error);
    }
  },

  // Soft-delete: preserva historial del taller en vez de borrar filas.
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
