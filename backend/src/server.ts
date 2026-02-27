import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import vehicleRoutes from './routes/vehicle.routes.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

import { ZodError } from 'zod';
import type { Request, Response, NextFunction } from 'express';

app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);

// Middleware de Manejo de Errores Global
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof ZodError) {
        res.status(400).json({ error: 'Error de validación de datos', details: (err as any).errors });
        return;
    }

    console.error('Error no capturado:', err);
    res.status(500).json({ error: 'Algo salió mal en el servidor' });
});

app.listen(port, () => {
    console.log(`[Server]: Moncar APIs listening at http://localhost:${port}`);
});
