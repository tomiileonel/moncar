import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

import { JWT_SECRET, ADMIN_REGISTER_SECRET } from '../config.js';

const prisma = new PrismaClient();

// Esquemas de Validación con Zod
const normalizedEmailSchema = z.preprocess(
    (value) => typeof value === 'string' ? value.trim().toLowerCase() : value,
    z.string().email("El correo no tiene un formato válido")
);

const registerSchema = z.object({
    name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres"),
    email: normalizedEmailSchema,
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
    adminSecret: z.string().trim().min(1, "El secreto de administrador es obligatorio")
});

const loginSchema = z.object({
    email: normalizedEmailSchema,
    password: z.string().min(1, "La contraseña es obligatoria")
});

export const authController = {
    // Registro de Admin
    register: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // Validación con Zod
            const { name, email, password, adminSecret } = registerSchema.parse(req.body);

            // Verificar secreto de administrador
            if (adminSecret !== ADMIN_REGISTER_SECRET) {
                res.status(403).json({ error: 'Secreto de registro inválido' });
                return;
            }

            // Verificar si el admin ya existe
            const existingAdmin = await prisma.admin.findUnique({ where: { email } });
            if (existingAdmin) {
                res.status(400).json({ error: 'Este correo ya está registrado.' });
                return;
            }

            // Hashear contraseña
            const hashedPassword = await bcrypt.hash(password, 10);

            // Crear admin
            await prisma.admin.create({
                data: {
                    name,
                    email,
                    password: hashedPassword,
                },
            });

            res.status(201).json({ message: 'Cuenta creada exitosamente' });
        } catch (error) {
            next(error); // Pasa el error al middleware global
        }
    },

    // Login de Admin
    login: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // Validación con Zod
            const { email, password } = loginSchema.parse(req.body);

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
            next(error); // Pasa el error al middleware global
        }
    }
};
