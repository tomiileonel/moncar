import type { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
export declare const vehicleController: {
    getAll: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    create: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    update: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    delete: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
};
//# sourceMappingURL=vehicle.controller.d.ts.map