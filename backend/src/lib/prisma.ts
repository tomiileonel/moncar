import { PrismaClient } from '@prisma/client';

// En serverless, cada cold start puede crear una instancia nueva de PrismaClient.
// Bajo concurrencia esto agota rápido el límite de conexiones de MySQL.
// Cachear en globalThis reutiliza la conexión entre invocaciones cuando
// Vercel reusa un contenedor "warm", y evita múltiples clients en dev con HMR.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env['VERCEL'] ? ['error', 'warn'] : ['query', 'error', 'warn'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}
