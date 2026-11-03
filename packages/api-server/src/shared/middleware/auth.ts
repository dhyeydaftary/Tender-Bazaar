import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import redis from '../../config/redis';
import { env } from '../../config/env';
import { AppError } from './error-handler';

/** The only algorithm the API signs or accepts access and refresh tokens with. */
export const JWT_ALGORITHM = 'HS256' as const;

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Access token required', 401, 'NO_TOKEN');
    }

    const token = authHeader.split(' ')[1];

    // Check if token is blacklisted
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      throw new AppError('Token has been revoked', 401, 'TOKEN_REVOKED');
    }

    // Only the configured secret is ever accepted, pinned to the algorithm the
    // API signs with (see modules/auth/service.ts).
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: [JWT_ALGORITHM] }) as any;
    const userId = decoded?.userId || decoded?.id || decoded?.sub;

    if (!userId) {
      throw new AppError('Invalid token payload', 401, 'INVALID_TOKEN');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        avatarUrl: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        subscription: {
          select: {
            id: true,
            status: true,
            billingCycle: true,
            endDate: true,
            plan: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found', 401, 'USER_NOT_FOUND');
    }

    // Check maintenance mode for non-admin users
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      const maintenanceSetting = await prisma.adminSetting.findUnique({
        where: { category_key: { category: 'general', key: 'maintenanceMode' } },
      });
      if (maintenanceSetting && maintenanceSetting.value === true) {
        throw new AppError('Platform is currently under maintenance. Please try again later.', 503, 'MAINTENANCE_MODE');
      }
    }

    (req as any).user = user;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError('Token expired', 401, 'TOKEN_EXPIRED'));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError('Invalid token', 401, 'INVALID_TOKEN'));
    }
    next(error);
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  authenticate(req, _res, (error) => {
    if (error) {
      // Don't fail for optional auth, just skip
      return next();
    }
    next();
  });
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return next(new AppError('Authentication required', 401, 'NOT_AUTHENTICATED'));
    }
    if (!roles.includes(user.role)) {
      return next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'));
    }
    next();
  };
}
