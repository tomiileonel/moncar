import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes.js';
import vehicleRoutes from './routes/vehicle.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import maintenanceRoutes from './routes/maintenance.routes.js';
import { PORT, CORS_ORIGIN } from './config.js';
import { prisma } from './lib/prisma.js';
import { globalRateLimiter } from './middleware/rate-limit.js';
import { errorHandler } from './middleware/error-handler.js';

const app = express();
if (process.env['VERCEL']) {
  app.set('trust proxy', 1);
}
app.use(globalRateLimiter);

// Security headers + CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
    },
  },
}));

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

// Nota: en Vercel el frontend (public/) lo sirve el CDN directamente vía
// Build Output — Express NO debe montar static() acá. El filesystem de la
// función es efímero/read-only y es tiempo de cómputo desperdiciado.
// app.use(express.static(...)) queda solo para `npm run dev` local si hace falta.

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/admin/reports', reportsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api', maintenanceRoutes);

// Global error handler — must be after all routes
app.use(errorHandler);

export default app;

if (!process.env['VERCEL']) {
  app.listen(PORT, () => {
    console.log(`[Server]: Moncar listening at http://localhost:${PORT}`);
  });

  // Graceful shutdown — solo aplica a proceso long-running local.
  // En Vercel el runtime gestiona el ciclo de vida del contenedor.
  const shutdown = async () => {
    console.log('Shutting down...');
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
