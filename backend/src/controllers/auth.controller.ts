import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { z } from 'zod';
 
import { APP_URL, JWT_SECRET, ADMIN_REGISTER_SECRET } from '../config.js';
import { prisma } from '../lib/prisma.js';
import type { AdminPayload, AuthRequest } from '../middleware/auth.js';
 
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
    // null/undefined = ilimitado (hasta expirar o ser revocada explícitamente).
    // Un número = cantidad exacta de altas que este link puede generar.
    maxUses: z.number().int().positive().nullable().optional().default(1),
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
 
export const authController = {
    login: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { email, password } = loginSchema.parse(req.body);
 
            const admin = await prisma.admin.findUnique({ where: { email } });
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
 
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
 
            res.json({ token, admin: payload });
        } catch (error) {
            next(error);
        }
    },
 
    // Crear Invitación (Solo OWNER)
    createInvite: async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const parsed = createInviteSchema.parse(req.body);
            const issuerId = req.admin!.id;
 
            const rawToken = crypto.randomBytes(32).toString('base64url');
            const isReusable = parsed.maxUses === null || parsed.maxUses > 1;
 
            const invite = await prisma.adminInvite.create({
                data: {
                    token: hashToken(rawToken),
                    role: parsed.role,
                    maxUses: parsed.maxUses,
                    issuedById: issuerId,
                    // Links con múltiples usos viven más: están pensados para
                    // quedar disponibles un tiempo (cartel del taller, grupo),
                    // no para usarse en el momento como una invitación 1:1.
                    expiresAt: new Date(Date.now() + (isReusable ? 1000 * 60 * 60 * 24 * 90 : 1000 * 60 * 60 * 24)),
                },
            });
 
            res.status(201).json({
                inviteUrl: `${APP_URL}/#token=${rawToken}`,
                expiresAt: invite.expiresAt,
                maxUses: invite.maxUses,
            });
        } catch (error) {
            next(error);
        }
    },
 
    // Registro mediante invitación (de un solo uso o con maxUses configurado)
    register: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { name, email, password, inviteToken } = registerSchema.parse(req.body);
            const tokenHash = hashToken(inviteToken);
 
            const invitePreview = await prisma.adminInvite.findUnique({ where: { token: tokenHash } });
            const previewValid =
                invitePreview &&
                !invitePreview.revokedAt &&
                invitePreview.expiresAt > new Date() &&
                (invitePreview.maxUses === null || invitePreview.useCount < invitePreview.maxUses);
 
            if (!previewValid) {
                res.status(403).json({ error: 'Invitación inválida, expirada o sin cupos disponibles' });
                return;
            }
 
            const existingAdmin = await prisma.admin.findUnique({ where: { email } });
            if (existingAdmin) {
                res.status(400).json({ error: 'Este correo ya está registrado.' });
                return;
            }
 
            const hashedPassword = await bcrypt.hash(password, 10);
 
            const admin = await prisma.$transaction(async (tx) => {
                // Atómico: la condición useCount < maxUses (o sin límite si
                // maxUses es null) se evalúa en la propia base de datos. Si dos
                // requests concurrentes compiten por el último cupo, solo una
                // logra el UPDATE — la otra recibe count: 0 y falla limpio.
                const claim = await tx.adminInvite.updateMany({
                    where: {
                        id: invitePreview!.id,
                        revokedAt: null,
                        expiresAt: { gt: new Date() },
                        ...(invitePreview!.maxUses !== null ? { useCount: { lt: invitePreview!.maxUses } } : {}),
                    },
                    data: {
                        useCount: { increment: 1 },
                        // Se mantiene por compat con cualquier lectura que
                        // todavía use usedAt como señal de "canjeada alguna vez".
                        usedAt: new Date(),
                    },
                });
 
                if (claim.count === 0) throw new Error('INVITE_ALREADY_CLAIMED');
 
                const created = await tx.admin.create({
                    data: {
                        name,
                        email,
                        password: hashedPassword,
                        role: invitePreview!.role,
                    },
                });
 
                // Trazabilidad indeleble: sobrevive incluso si la invitación
                // se revoca o expira después — siempre se puede reconstruir
                // quién se registró con cada token.
                await tx.adminInviteRedemption.create({
                    data: { inviteId: invitePreview!.id, adminId: created.id },
                });
 
                return created;
            });
 
            res.status(201).json({ message: 'Cuenta creada exitosamente' });
        } catch (error) {
            if (error instanceof Error && error.message === 'INVITE_ALREADY_CLAIMED') {
                res.status(409).json({ error: 'Esta invitación ya fue utilizada o alcanzó su límite de usos' });
                return;
            }
            next(error);
        }
    },
 
    registerPin: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { name, email, password, pin } = registerPinSchema.parse(req.body);
 
            if (pin !== ADMIN_REGISTER_SECRET) {
                res.status(401).json({ error: 'PIN de acceso inválido' });
                return;
            }
 
            const existingAdmin = await prisma.admin.findUnique({ where: { email } });
            if (existingAdmin) {
                res.status(400).json({ error: 'Este correo ya está registrado.' });
                return;
            }
 
            const hashedPassword = await bcrypt.hash(password, 10);
            await prisma.admin.create({
                data: { name, email, password: hashedPassword, role: 'MECHANIC' },
            });
 
            res.status(201).json({ message: 'Cuenta creada exitosamente' });
        } catch (error) {
            next(error);
        }
    }
};
