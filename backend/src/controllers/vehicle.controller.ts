import type { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { AuthRequest } from '../middleware/auth.js';

const prisma = new PrismaClient();

const clientCreateSchema = z.object({
  owner: z.string().min(1, 'El propietario es requerido'),
  phone: z.string().regex(/^\d{7,15}$/, 'El teléfono debe tener entre 7 y 15 dígitos'),
  type: z.string().min(1, 'El tipo es requerido'),
  carname: z.string().min(1, 'La marca es requerida'),
  model: z.string().min(1, 'El modelo/año es requerido'),
  km: z.string().optional().nullable(),
  problem: z.string().min(1, 'El problema es requerido'),
});

const adminCreateSchema = clientCreateSchema.extend({
  entry: z.string().min(1).optional(),
  exit: z.string().optional().nullable(),
  cost_labor: z.string().optional().nullable(),
  cost_parts: z.string().optional().nullable(),
  status: z.string().optional(),
});

// Old schema used temporarily for update until Fase 3
const vehicleSchema = z.object({
    owner: z.string().min(1, "El propietario es requerido"),
    phone: z.string().regex(/^\d{7,15}$/, "El teléfono debe tener entre 7 y 15 dígitos"),
    type: z.string().min(1, "El tipo es requerido"),
    carname: z.string().min(1, "La marca es requerida"),
    model: z.string().min(1, "El año/modelo es requerido"),
    km: z.string().optional().nullable(),
    entry: z.string().min(1, "La fecha de ingreso es requerida"),
    exit: z.string().optional().nullable(),
    problem: z.string().min(1, "El problema es requerido"),
    cost_labor: z.string().optional().nullable(),
    cost_parts: z.string().optional().nullable(),
    status: z.string().optional(),
    source: z.string().optional()
});

export const vehicleController = {
    // GET all vehicles
    getAll: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const vehicles = await prisma.vehicle.findMany({
                orderBy: { createdAt: 'desc' },
            });
            const formattedVehicles = vehicles.map((v: any) => ({
                ...v,
                id: v.id.toString()
            }));
            res.json(formattedVehicles);
        } catch (error) {
            next(error);
        }
    },

    createClient: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = clientCreateSchema.parse(req.body);
            const vehicle = await prisma.vehicle.create({
                data: {
                    owner: data.owner,
                    phone: data.phone,
                    type: data.type,
                    carname: data.carname,
                    model: data.model,
                    km: data.km || null,
                    problem: data.problem,
                    entry: new Date().toISOString().substring(0, 10),
                    source: 'client',
                    status: 'Pendiente',
                },
            });
            res.status(201).json({
                ...vehicle,
                id: vehicle.id.toString()
            });
        } catch (error) {
            next(error);
        }
    },

    createAdmin: async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const data = adminCreateSchema.parse(req.body);
            const vehicle = await prisma.vehicle.create({
                data: {
                    owner: data.owner,
                    phone: data.phone,
                    type: data.type,
                    carname: data.carname,
                    model: data.model,
                    km: data.km || null,
                    problem: data.problem,
                    entry: data.entry || new Date().toISOString().substring(0, 10),
                    exit: data.exit || null,
                    cost_labor: data.cost_labor || null,
                    cost_parts: data.cost_parts || null,
                    source: 'admin',
                    status: data.status || 'Pendiente',
                },
            });
            res.status(201).json({
                ...vehicle,
                id: vehicle.id.toString()
            });
        } catch (error) {
            next(error);
        }
    },

    createCompat: async (req: AuthRequest, res: Response, next: NextFunction) => {
        if (req.admin) {
            return vehicleController.createAdmin(req, res, next);
        }
        return vehicleController.createClient(req as Request, res, next);
    },

    // PUT update vehicle
    update: async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            const validatedData = vehicleSchema.parse(req.body);

            const updatedVehicle = await prisma.vehicle.update({
                where: { id: parseInt(id as string) },
                data: {
                    owner: validatedData.owner,
                    phone: validatedData.phone,
                    type: validatedData.type,
                    carname: validatedData.carname,
                    model: validatedData.model,
                    km: validatedData.km || null,
                    entry: validatedData.entry,
                    exit: validatedData.exit || null,
                    problem: validatedData.problem,
                    cost_labor: validatedData.cost_labor?.toString() || null,
                    cost_parts: validatedData.cost_parts?.toString() || null,
                    ...(validatedData.status ? { status: validatedData.status } : {}),
                    ...(validatedData.source ? { source: validatedData.source } : {})
                }
            });

            res.json({
                ...updatedVehicle,
                id: updatedVehicle.id.toString()
            });
        } catch (error) {
            next(error);
        }
    },

    // DELETE vehicle
    delete: async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;
            await prisma.vehicle.delete({
                where: { id: parseInt(id as string) }
            });
            res.json({ message: 'Vehículo eliminado con éxito' });
        } catch (error) {
            next(error);
        }
    }
};
