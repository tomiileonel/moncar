import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-moncar-123';

// Registro de Admin
router.post('/register', async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, email, password } = req.body;

        // Verificar si el admin ya existe
        const existingAdmin = await prisma.admin.findUnique({ where: { email } });
        if (existingAdmin) {
            res.status(400).json({ error: 'Este correo ya está registrado.' });
            return;
        }

        // Hashear contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // Crear admin
        const admin = await prisma.admin.create({
            data: {
                name,
                email,
                password: hashedPassword,
            },
        });

        res.status(201).json({ message: 'Cuenta creada exitosamente' });
    } catch (error) {
        console.error('Error in /register:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Login de Admin
router.post('/login', async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        const admin = await prisma.admin.findUnique({ where: { email } });
        if (!admin) {
            res.status(401).json({ error: 'Correo o contraseña incorrectos' });
            return;
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            res.status(401).json({ error: 'Correo o contraseña incorrectos' });
            return;
        }

        const token = jwt.sign(
            { id: admin.id, email: admin.email, name: admin.name },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email } });
    } catch (error) {
        console.error('Error in /login:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

export default router;
