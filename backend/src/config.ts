import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    const message = `Missing required environment variable: ${name}`;
    // En serverless (Vercel), process.exit() mata la función a mitad de un
    // cold start antes de registrar rutas → Vercel resuelve como 404/502.
    // Lanzar en cambio permite que el error handler de Express responda 500
    // con contexto real, y queda visible en Vercel → Logs.
    if (process.env['VERCEL']) {
      throw new Error(`FATAL: ${message}`);
    }
    console.error(`❌ FATAL: ${message}`);
    process.exit(1);
  }
  return value;
}

export const JWT_SECRET = requireEnv('JWT_SECRET');
export const PORT = parseInt(process.env['PORT'] || '3000', 10);
export const CORS_ORIGIN = process.env['CORS_ORIGIN']
  || (process.env['VERCEL_URL'] ? `https://${process.env['VERCEL_URL']}` : `http://localhost:${PORT}`);
