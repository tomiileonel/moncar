import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
const router = Router();
const prisma = new PrismaClient();
// GET all vehicles
router.get('/', async (req, res) => {
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
        console.error('Error fetching vehicles:', error);
        res.status(500).json({ error: 'Error al obtener vehículos' });
    }
});
// POST new vehicle (can be called by Client or Admin)
router.post('/', async (req, res) => {
    try {
        // Para simplificar, recibimos el payload tal cual el frontend lo envía
        const { owner, phone, type, carname, model, km, entry, exit, problem, cost_labor, cost_parts, status, source } = req.body;
        const newVehicle = await prisma.vehicle.create({
            data: {
                owner,
                phone,
                type,
                carname,
                model,
                km,
                entry,
                exit,
                problem,
                cost_labor: cost_labor?.toString() || null,
                cost_parts: cost_parts?.toString() || null,
                status: status || 'Pendiente',
                source: source || 'client'
            }
        });
        res.status(201).json({
            ...newVehicle,
            id: newVehicle.id.toString()
        });
    }
    catch (error) {
        console.error('Error creating vehicle:', error);
        res.status(500).json({ error: 'Error al registrar vehículo' });
    }
});
// PUT update vehicle (Admin only)
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { owner, phone, type, carname, model, km, entry, exit, problem, cost_labor, cost_parts, status } = req.body;
        const updatedVehicle = await prisma.vehicle.update({
            where: { id: parseInt(id) },
            data: {
                owner,
                phone,
                type,
                carname,
                model,
                km,
                entry,
                exit,
                problem,
                cost_labor: cost_labor?.toString() || null,
                cost_parts: cost_parts?.toString() || null,
                status
            }
        });
        res.json({
            ...updatedVehicle,
            id: updatedVehicle.id.toString()
        });
    }
    catch (error) {
        console.error('Error updating vehicle:', error);
        res.status(500).json({ error: 'Error al actualizar vehículo' });
    }
});
// DELETE vehicle (Admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.vehicle.delete({
            where: { id: parseInt(id) }
        });
        res.json({ message: 'Vehículo eliminado con éxito' });
    }
    catch (error) {
        console.error('Error deleting vehicle:', error);
        res.status(500).json({ error: 'Error al eliminar vehículo' });
    }
});
export default router;
//# sourceMappingURL=vehicle.routes.js.map