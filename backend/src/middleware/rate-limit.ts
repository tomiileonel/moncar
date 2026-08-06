import rateLimit from 'express-rate-limit';

export const authRegisterRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5,
  message: { error: 'Demasiados registros. Esperá 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLoginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos fallidos. Esperá 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const clientRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10,
  message: { error: 'Demasiados registros. Intentá más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const trackingRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiadas consultas. Esperá 15 minutos e intentá de nuevo.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
