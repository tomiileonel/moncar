import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
const prisma = new PrismaClient();
// Esquema de Validación con Zod para vehículos
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
    getAll: async (req, res, next) => {
        try {
            const vehicles = await prisma.vehicle.findMany({
                orderBy: { createdAt: 'desc' },
            });
            // Formatear los id a string para mantener compatibilidad con el frontend
            const formattedVehicles = vehicles.map((v) => ({
                ...v,
                id: v.id.toString()
            }));
            res.json(formattedVehicles);
        }
        catch (error) {
            next(error);
        }
    },
    // POST new vehicle
    create: async (req, res, next) => {
        try {
            // Validar payload con Zod
            const validatedData = vehicleSchema.parse(req.body);
            const newVehicle = await prisma.vehicle.create({
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
                    status: validatedData.status || 'Pendiente',
                    source: validatedData.source || 'client'
                }
            });
            res.status(201).json({
                ...newVehicle,
                id: newVehicle.id.toString()
            });
        }
        catch (error) {
            next(error);
        }
    },
    // PUT update vehicle
    update: async (req, res, next) => {
        try {
            const { id } = req.params;
            // Validar payload con Zod
            const validatedData = vehicleSchema.parse(req.body);
            const updatedVehicle = await prisma.vehicle.update({
                where: { id: parseInt(id) },
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
        }
        catch (error) {
            next(error);
        }
    },
    // DELETE vehicle
    delete: async (req, res, next) => {
        try {
            const { id } = req.params;
            await prisma.vehicle.delete({
                where: { id: parseInt(id) }
            });
            res.json({ message: 'Vehículo eliminado con éxito' });
        }
        catch (error) {
            next(error);
        }
    }
};
//# sourceMappingURL=vehicle.controller.js.map