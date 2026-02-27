import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-moncar-123';
export const authenticateToken = (req, res, next) => {
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
        req.admin = user;
        next();
    });
};
//# sourceMappingURL=auth.js.map