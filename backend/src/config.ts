import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`❌ FATAL: Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

export const JWT_SECRET = requireEnv('JWT_SECRET');
export const ADMIN_REGISTER_SECRET = requireEnv('ADMIN_REGISTER_SECRET');
export const PORT = parseInt(process.env['PORT'] || '3000', 10);
export const CORS_ORIGIN = process.env['CORS_ORIGIN'] || `http://localhost:${PORT}`;
