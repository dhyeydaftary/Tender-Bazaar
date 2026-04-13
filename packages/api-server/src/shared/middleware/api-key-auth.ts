import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { apiKeyService } from '../../modules/api-keys/service';
import { AppError } from './error-handler';

/**
 * Middleware to authenticate requests using an API key (Bearer token).
 * Used for external API consumers (Enterprise plan).
 *
 * Expected header: Authorization: Bearer tb_live_...
 */
export async function authenticateApiKey(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('API key required. Pass your key as a Bearer token.', 401, 'NO_API_KEY');
    }

    const key = authHeader.split(' ')[1];

    // Only process keys that look like API keys (not JWTs)
    if (!key.startsWith('tb_live_')) {
      throw new AppError('Invalid API key format.', 401, 'INVALID_API_KEY_FORMAT');
    }

    // Validate key and check rate limit
    const userId = await apiKeyService.validateApiKey(key);

    // Fetch user info and attach to request
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
      },
    });

    if (!user) {
      throw new AppError('User associated with this API key not found.', 401, 'USER_NOT_FOUND');
    }

    (req as any).user = user;
    (req as any).authMethod = 'api_key';
    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    next(new AppError('API key authentication failed.', 401, 'API_KEY_AUTH_FAILED'));
  }
}
