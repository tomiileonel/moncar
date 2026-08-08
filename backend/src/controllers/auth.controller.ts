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
    standing: z.boolean().default(false),
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
                    // null = reutilizable hasta expirar o ser revocado manualmente;
                    // 1 = single-use (comportamiento previo, sin cambios).
                    maxUses: parsed.standing ? null : 1,
                },
            });
 
            res.status(201).json({
                inviteUrl: `${APP_URL}/#token=${rawToken}`,
                standing: parsed.standing,
                expiresAt: invite.expiresAt,
            });
        } catch (error) {
            next(error);
        }
    },
 
    // Registro mediante invitación (single-use o standing/reutilizable)
    register: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { name, email, password, inviteToken } = registerSchema.parse(req.body);
            const tokenHash = hashToken(inviteToken);
 
            // Verificación rápida "optimista" (buena UX: 403 temprano si el
            // token nunca existió). NO es la fuente de verdad contra la race
            // condition — eso lo hace el updateMany condicional de abajo.
            const invitePreview = await prisma.adminInvite.findUnique({ where: { token: tokenHash } });
            if (!invitePreview) {
                res.status(403).json({ error: 'Invitación inválida o inexistente' });
                return;
            }
            if (invitePreview.revokedAt) {
                res.status(403).json({ error: 'Esta invitación fue revocada' });
                return;
            }
            if (invitePreview.expiresAt < new Date()) {
                res.status(403).json({ error: 'Esta invitación expiró' });
                return;
            }
            const isSingleUse = invitePreview.maxUses === 1;
            if (isSingleUse && invitePreview.usedAt) {
                res.status(403).json({ error: 'Esta invitación ya fue utilizada' });
                return;
            }
            if (invitePreview.maxUses !== null && invitePreview.useCount >= invitePreview.maxUses) {
                res.status(403).json({ error: 'Esta invitación alcanzó su límite de usos' });
                return;
            }
 
            const existingAdmin = await prisma.admin.findUnique({ where: { email } });
            if (existingAdmin) {
                res.status(400).json({ error: 'Este correo ya está registrado.' });
                return;
            }
 
            // bcrypt.hash es deliberadamente lento (~100-200ms) — es la ventana
            // donde dos requests con el mismo token pueden colarse si solo
            // validamos usedAt/useCount antes de la transacción. Por eso la
            // revalidación real ocurre DENTRO de la transacción, vía updateMany
            // condicional: solo las requests que efectivamente caben dentro del
            // cupo (maxUses null = ilimitado, o useCount < maxUses) logran
            // reclamar un uso. Postgres serializa el UPDATE por fila, así que
            // dos requests concurrentes sobre el mismo invite nunca pueden
            // ambas pasar el mismo where.
            const hashedPassword = await bcrypt.hash(password, 10);
 
            const admin = await prisma.$transaction(async (tx) => {
                const claim = await tx.adminInvite.updateMany({
                    where: {
                        id: invitePreview.id,
                        revokedAt: null,
                        expiresAt: { gt: new Date() },
                        ...(isSingleUse
                            ? { usedAt: null }
                            : { OR: [{ maxUses: null }, { useCount: { lt: invitePreview.maxUses ?? 0 } }] }),
                    },
                    data: {
                        useCount: { increment: 1 },
                        ...(isSingleUse ? { usedAt: new Date() } : {}),
                    },
                });
 
                if (claim.count === 0) {
                    // Perdió la carrera contra otra request, se agotó el cupo,
                    // o expiró/fue revocada justo ahora.
                    throw new Error('INVITE_ALREADY_CLAIMED');
                }
 
                const created = await tx.admin.create({
                    data: {
                        name,
                        email,
                        password: hashedPassword,
                        role: invitePreview.role,
                    },
                });
 
                // Trazabilidad individual: incluso en un invite reutilizable,
                // queda registrado quién se sumó a través de él y cuándo.
                await tx.adminInviteRedemption.create({
                    data: { inviteId: invitePreview.id, adminId: created.id },
                });
 
                return created;
            });
 
            const payload: AdminPayload = {
                id: admin.id,
                email: admin.email,
                name: admin.name,
                role: admin.role,
            };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
 
            res.status(201).json({ token, admin: payload });
        } catch (error) {
            if (error instanceof Error && error.message === 'INVITE_ALREADY_CLAIMED') {
                res.status(409).json({ error: 'Esta invitación ya no está disponible' });
                return;
            }
            next(error);
        }
    }
};
