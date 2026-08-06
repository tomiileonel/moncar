import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { AdminRole } from '@prisma/client';

import { JWT_SECRET } from '../config.js';

export interface AdminPayload {
    id: number;
    email: string;
    name: string;
    role: AdminRole;
}

export interface AuthRequest extends Request {
    admin?: AdminPayload;
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        res.status(401).json({ error: 'Acceso denegado: Token no proporcionado' });
        return;
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET) as AdminPayload;
        if (!payload.role) {
            // Token emitido antes de que el rol formara parte del payload: ya no es válido.
            res.status(401).json({ error: 'Token obsoleto, iniciá sesión de nuevo' });
            return;
        }
        req.admin = payload;
        next();
    } catch {
        res.status(401).json({ error: 'Token inválido o expirado' });
    }
};

export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
        try {
            const payload = jwt.verify(token, JWT_SECRET) as AdminPayload;
            if (payload.role) {
                req.admin = payload;
            }
        } catch {
            // Ignoramos errores en auth opcional
        }
    }
    next();
};

/**
 * Debe montarse SIEMPRE después de authenticateToken.
 * Uso: router.delete('/:id', authenticateToken, requireRole(['OWNER']), handler)
 */
export const requireRole = (allowed: AdminRole[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.admin) {
            // Defensa en profundidad: si esto dispara, el middleware está mal ordenado.
            res.status(401).json({ error: 'No autenticado' });
            return;
        }
        if (!allowed.includes(req.admin.role)) {
            res.status(403).json({ error: 'No tenés permisos para esta acción' });
            return;
        }
        next();
    };
};
