import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { VehicleType, VehicleStatus, Prisma } from '@prisma/client';
import { InsufficientStockError, InventoryItemNotFoundError, InventoryItemInactiveError } from '../src/services/inventory.service.js';
import { errorHandler } from '../src/middleware/error-handler.js';

// Replicating schemas matching vehicle.controller.ts for deterministic unit testing
const vehicleTypeSchema = z.nativeEnum(VehicleType);
const vehicleStatusSchema = z.nativeEnum(VehicleStatus);
const plateSchema = z.string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9 -]{5,12}$/, 'La patente debe tener entre 5 y 12 caracteres');

const optionalIntFromString = z
  .string()
  .optional()
  .nullable()
  .transform((val) => {
    if (!val || val.trim() === '') return null;
    const parsed = Number.parseInt(val, 10);
    return Number.isNaN(parsed) ? null : parsed;
  });

const requiredIntFromString = z
  .string()
  .min(1, 'El kilometraje es requerido')
  .transform((val, ctx) => {
    const parsed = Number.parseInt(val, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'El kilometraje debe ser un número positivo' });
      return z.NEVER;
    }
    return parsed;
  });

const clientCreateSchema = z.object({
  owner: z.string().min(1, 'El propietario es requerido'),
  phone: z.string().regex(/^\d{7,15}$/, 'El teléfono debe tener entre 7 y 15 dígitos'),
  plate: plateSchema,
  type: vehicleTypeSchema,
  carname: z.string().min(1, 'La marca es requerida'),
  year: optionalIntFromString,
  km: requiredIntFromString,
  problem: z.string().min(1, 'El problema es requerido'),
});

const adminCreateSchema = clientCreateSchema.extend({
  km: optionalIntFromString,
  cost_labor: z.string().optional().nullable(),
  cost_parts: z.string().optional().nullable(),
  status: vehicleStatusSchema.optional(),
});

describe('Vehicle Registration - Plate Validation', () => {
  it('should accept valid plate formats (Mercosur and traditional)', () => {
    expect(plateSchema.parse('AA123BB')).toBe('AA123BB');
    expect(plateSchema.parse('abc123')).toBe('ABC123'); // auto-uppercased
    expect(plateSchema.parse('AA-123-BB')).toBe('AA-123-BB');
    expect(plateSchema.parse(' AA 123 BB ')).toBe('AA 123 BB');
  });

  it('should reject invalid plate formats', () => {
    expect(() => plateSchema.parse('AB')).toThrow();
    expect(() => plateSchema.parse('AA1234567890123')).toThrow();
    expect(() => plateSchema.parse('AB@123!')).toThrow();
  });
});

describe('Vehicle Registration - Client vs Admin Schema Constraints', () => {
  it('should enforce required positive km in client registration', () => {
    const validClientPayload = {
      owner: 'Juan Perez',
      phone: '1123456789',
      plate: 'AA123BB',
      type: 'AUTO',
      carname: 'Fiat Cronos',
      year: '2022',
      km: '25000',
      problem: 'Cambio de aceite y filtro',
    };

    const parsed = clientCreateSchema.parse(validClientPayload);
    expect(parsed.km).toBe(25000);
    expect(parsed.year).toBe(2022);
    expect(parsed.plate).toBe('AA123BB');

    // Missing km
    expect(() => clientCreateSchema.parse({ ...validClientPayload, km: '' })).toThrow();
    // Negative km
    expect(() => clientCreateSchema.parse({ ...validClientPayload, km: '-10' })).toThrow();
    // Non-numeric km
    expect(() => clientCreateSchema.parse({ ...validClientPayload, km: 'veinte mil' })).toThrow();
  });

  it('should allow optional km in admin registration', () => {
    const validAdminPayload = {
      owner: 'Admin Carga',
      phone: '1198765432',
      plate: 'AF999ZZ',
      type: 'CAMIONETA',
      carname: 'Toyota Hilux',
      year: '2023',
      km: '',
      problem: 'Revision integral de frenos',
      status: 'PENDIENTE',
    };

    const parsed = adminCreateSchema.parse(validAdminPayload);
    expect(parsed.km).toBeNull();
    expect(parsed.status).toBe('PENDIENTE');
  });

  it('should enforce valid phone number digits (7 to 15 digits)', () => {
    const payload = {
      owner: 'Carlos Test',
      phone: '123', // too short
      plate: 'AA123BB',
      type: 'AUTO',
      carname: 'Ford Focus',
      km: '50000',
      problem: 'Ruidos en tren delantero',
    };

    expect(() => clientCreateSchema.parse(payload)).toThrow();
    expect(() => clientCreateSchema.parse({ ...payload, phone: '1123456789' })).not.toThrow();
  });
});

describe('Error Handler Response Mapping', () => {
  it('should map InsufficientStockError to HTTP 409', () => {
    let statusCode = 0;
    let responseBody: unknown = null;

    const mockRes: any = {
      status: (code: number) => {
        statusCode = code;
        return mockRes;
      },
      json: (data: unknown) => {
        responseBody = data;
        return mockRes;
      },
    };

    errorHandler(new InsufficientStockError('Pastillas de freno'), {} as any, mockRes, () => {});

    expect(statusCode).toBe(409);
    expect(responseBody).toEqual({ error: 'Stock insuficiente para Pastillas de freno' });
  });

  it('should map InventoryItemInactiveError to HTTP 409', () => {
    let statusCode = 0;
    let responseBody: unknown = null;

    const mockRes: any = {
      status: (code: number) => {
        statusCode = code;
        return mockRes;
      },
      json: (data: unknown) => {
        responseBody = data;
        return mockRes;
      },
    };

    errorHandler(new InventoryItemInactiveError(42), {} as any, mockRes, () => {});

    expect(statusCode).toBe(409);
    expect(responseBody).toEqual({ error: 'El repuesto #42 está inactivo' });
  });

  it('should map InventoryItemNotFoundError to HTTP 400', () => {
    let statusCode = 0;
    let responseBody: unknown = null;

    const mockRes: any = {
      status: (code: number) => {
        statusCode = code;
        return mockRes;
      },
      json: (data: unknown) => {
        responseBody = data;
        return mockRes;
      },
    };

    errorHandler(new InventoryItemNotFoundError(999), {} as any, mockRes, () => {});

    expect(statusCode).toBe(400);
    expect(responseBody).toEqual({ error: 'El repuesto #999 no existe' });
  });

  it('should map Prisma P2025 (record not found) to HTTP 404', () => {
    let statusCode = 0;
    let responseBody: unknown = null;

    const mockRes: any = {
      status: (code: number) => {
        statusCode = code;
        return mockRes;
      },
      json: (data: unknown) => {
        responseBody = data;
        return mockRes;
      },
    };

    const prismaError = new Prisma.PrismaClientKnownRequestError('Record to update not found.', {
      code: 'P2025',
      clientVersion: '5.22.0',
    });

    errorHandler(prismaError, {} as any, mockRes, () => {});

    expect(statusCode).toBe(404);
    expect(responseBody).toEqual({ error: 'Vehículo no encontrado' });
  });

  it('should map ZodError to HTTP 400 with details array', () => {
    let statusCode = 0;
    let responseBody: any = null;

    const mockRes: any = {
      status: (code: number) => {
        statusCode = code;
        return mockRes;
      },
      json: (data: unknown) => {
        responseBody = data;
        return mockRes;
      },
    };

    try {
      clientCreateSchema.parse({ owner: '' });
    } catch (err) {
      errorHandler(err, {} as any, mockRes, () => {});
    }

    expect(statusCode).toBe(400);
    expect(responseBody.error).toBe('Datos inválidos');
    expect(Array.isArray(responseBody.details)).toBe(true);
    expect(responseBody.details.length).toBeGreaterThan(0);
  });
});
