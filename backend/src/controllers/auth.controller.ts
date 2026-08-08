import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { z } from 'zod';

import { APP_URL, JWT_SECRET, ADMIN_REGISTER_SECRET } from '../config.js';
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

const registerPinSchema = z.object({
    name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres"),
    email: normalizedEmailSchema,
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
    pin: z.string().min(1, "El PIN es obligatorio"),
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

            // Verificación rápida "optimista" (buena UX: 403 temprano si el
            // token nunca existió). NO es la fuente de verdad contra la race
            // condition — eso lo hace el updateMany condicional de abajo.
            const invitePreview = await prisma.adminInvite.findUnique({ where: { token: tokenHash } });
            if (!invitePreview || invitePreview.usedAt || invitePreview.expiresAt < new Date()) {
                res.status(403).json({ error: 'Invitación inválida o expirada' });
                return;
            }

            const existingAdmin = await prisma.admin.findUnique({ where: { email } });
            if (existingAdmin) {
                res.status(400).json({ error: 'Este correo ya está registrado.' });
                return;
            }

            // bcrypt.hash es deliberadamente lento (~100-200ms) — es la ventana
            // donde dos requests con el mismo token pueden colarse si solo
            // validamos usedAt antes de la transacción. Por eso la revalidación
            // real ocurre DENTRO de la transacción, vía updateMany condicional:
            // solo una de las dos requests concurrentes logra marcar usedAt.
            const hashedPassword = await bcrypt.hash(password, 10);

            const admin = await prisma.$transaction(async (tx) => {
                // Atómico: MySQL/Postgres garantiza que solo una transacción
                // concurrente puede hacer este UPDATE con éxito (count === 1).
                const claim = await tx.adminInvite.updateMany({
                    where: {
                        id: invitePreview.id,
                        usedAt: null,
                        expiresAt: { gt: new Date() },
                    },
                    data: { usedAt: new Date() },
                });

                if (claim.count === 0) {
                    // Perdió la carrera contra otra request, o expiró justo ahora.
                    throw new Error('INVITE_ALREADY_CLAIMED');
                }

                return tx.admin.create({
                    data: {
                        name,
                        email,
                        password: hashedPassword,
                        role: invitePreview.role,
                    },
                });
            });

            res.status(201).json({ message: 'Cuenta creada exitosamente' });
        } catch (error) {
            if (error instanceof Error && error.message === 'INVITE_ALREADY_CLAIMED') {
                res.status(409).json({ error: 'Esta invitación ya fue utilizada' });
                return;
            }
            next(error);
        }
    },

    registerPin: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { name, email, password, pin } = registerPinSchema.parse(req.body);

            // 1. Validar el PIN estático
            if (pin !== ADMIN_REGISTER_SECRET) {
                // Claude advirtió: El mensaje de error debe ser genérico y no dar pistas
                res.status(401).json({ error: 'PIN de acceso inválido' });
                return;
            }

            // 2. Verificar que el email no exista
            const existingAdmin = await prisma.admin.findUnique({ where: { email } });
            if (existingAdmin) {
                // Mensaje genérico para no filtrar si el error es el PIN o el email,
                // aunque en PIN inválido se corta antes, mantener la ambigüedad aquí
                // no es tan crucial, pero igual respetaremos lo pedido.
                res.status(400).json({ error: 'Este correo ya está registrado.' });
                return;
            }

            // 3. Crear el administrador SIEMPRE con rol MECHANIC
            const hashedPassword = await bcrypt.hash(password, 10);
            await prisma.admin.create({
                data: {
                    name,
                    email,
                    password: hashedPassword,
                    role: 'MECHANIC', // Hardcodeado como literal, según requerimiento de seguridad
                },
            });

            res.status(201).json({ message: 'Cuenta creada exitosamente' });
        } catch (error) {
            next(error);
        }
    }
};
