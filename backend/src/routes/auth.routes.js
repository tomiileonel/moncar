"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-moncar-123';
// Registro de Admin
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        // Verificar si el admin ya existe
        const existingAdmin = await prisma.admin.findUnique({ where: { email } });
        if (existingAdmin) {
            res.status(400).json({ error: 'Este correo ya está registrado.' });
            return;
        }
        // Hashear contraseña
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        // Crear admin
        const admin = await prisma.admin.create({
            data: {
                name,
                email,
                password: hashedPassword,
            },
        });
        res.status(201).json({ message: 'Cuenta creada exitosamente' });
    }
    catch (error) {
        console.error('Error in /register:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});
// Login de Admin
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await prisma.admin.findUnique({ where: { email } });
        if (!admin) {
            res.status(401).json({ error: 'Correo o contraseña incorrectos' });
            return;
        }
        const isMatch = await bcrypt_1.default.compare(password, admin.password);
        if (!isMatch) {
            res.status(401).json({ error: 'Correo o contraseña incorrectos' });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ id: admin.id, email: admin.email, name: admin.name }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email } });
    }
    catch (error) {
        console.error('Error in /login:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.routes.js.map