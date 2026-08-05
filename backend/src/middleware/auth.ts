import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import { JWT_SECRET } from '../config.js';

export interface AdminPayload {
    id: number;
    email: string;
    name: string;
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

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            res.status(403).json({ error: 'Token inválido o expirado' });
            return;
        }
        req.admin = user as AdminPayload;
        next();
    });
};
