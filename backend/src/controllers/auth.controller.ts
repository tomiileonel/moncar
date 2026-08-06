import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { z } from 'zod';

import { APP_URL, JWT_SECRET } from '../config.js';
import { prisma } from '../lib/prisma.js';
import type { AdminPayload, AuthRequest } from '../middleware/auth.js';

// Esquemas de Validación con Zod
const normalizedEmailSchema = z.preprocess(
    (value) => typeof value === 'string' ? value.trim().toLowerCase() : value,
    z.string().email("El correo no tiene un formato válido")
);

const loginSchema = z.object({
    email: normalizedEmailSchema,
    password: z.string().min(1, "La contraseña es obligatoria")
});

const createInviteSchema = z.object({
    role: z.enum(['OWNER', 'MECHANIC']).default('MECHANIC'),
});

const registerSchema = z.object({
    name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres"),
    email: normalizedEmailSchema,
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
    inviteToken: z.string().min(1, "El token de invitación es obligatorio"),
});

function hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
}

class InviteAlreadyUsedError extends Error {
    constructor() {
        super('INVITE_ALREADY_USED');
        this.name = 'InviteAlreadyUsedError';
    }
}

export const authController = {
    // Login de Admin
    login: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { email, password } = loginSchema.parse(req.body);

            const admin = await prisma.admin.findUnique({ where: { email } });
            // Mismo mensaje exista o no el email
            if (!admin || !(await bcrypt.compare(password, admin.password))) {
                res.status(401).json({ error: 'Correo o contraseña incorrectos' });
                return;
            }

            const payload: AdminPayload = {
                id: admin.id,
                email: admin.email,
                name: admin.name,
                role: admin.role,
            };

            const token = jwt.sign(
                payload,
                JWT_SECRET,
                { expiresIn: '8h' }
            );

            res.json({ token, admin: payload });
        } catch (error) {
            next(error);
        }
    },

    // Crear Invitación (Solo OWNER)
    createInvite: async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = createInviteSchema.parse(req.body);
            
            // requireRole(['OWNER']) ya garantizó req.admin en la cadena de middleware.
            const issuerId = req.admin!.id;

            const rawToken = crypto.randomBytes(32).toString('base64url');
            
            const invite = await prisma.adminInvite.create({
                data: {
                    token: hashToken(rawToken),
                    role: parsed.role,
                    issuedById: issuerId,
                    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24h
                },
            });

            res.status(201).json({
                inviteUrl: `${APP_URL}/#token=${rawToken}`,
                expiresAt: invite.expiresAt,
            });
        } catch (error) {
            next(error);
        }
    },

    // Registro mediante invitación
    register: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { name, email, password, inviteToken } = registerSchema.parse(req.body);
            
            const tokenHash = hashToken(inviteToken);

            const invite = await prisma.adminInvite.findUnique({ where: { token: tokenHash } });
            if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
                res.status(403).json({ error: 'Invitación inválida o expirada' });
                return;
            }

            const existingAdmin = await prisma.admin.findUnique({ where: { email } });
            if (existingAdmin) {
                res.status(400).json({ error: 'Este correo ya está registrado.' });
                return;
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            try {
                await prisma.$transaction(async (tx) => {
                    // Update condicional atómico: Si otro request paralelo ya la marcó, count será 0.
                    // Esto evita el TOCTOU dado que la DB serializa estos updates condicionales.
                    const updateResult = await tx.adminInvite.updateMany({
                        where: { id: invite.id, usedAt: null, expiresAt: { gt: new Date() } },
                        data: { usedAt: new Date() },
                    });

                    if (updateResult.count === 0) {
                        throw new InviteAlreadyUsedError();
                    }

                    await tx.admin.create({
                        data: {
                            name,
                            email,
                            password: hashedPassword,
                            role: invite.role,
                        },
                    });
                });
            } catch (error: unknown) {
                if (error instanceof InviteAlreadyUsedError) {
                    res.status(403).json({ error: 'La invitación ya fue utilizada o expiró concurrentemente.' });
                    return;
                }
                throw error;
            }

            res.status(201).json({ message: 'Cuenta creada exitosamente' });
        } catch (error) {
            next(error);
        }
    }
};
