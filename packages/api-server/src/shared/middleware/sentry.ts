import { Request, Response, NextFunction } from 'express';

export function sentryErrorHandler(err: Error, req: Request, _res: Response, next: NextFunction) {
  const dsn = process.env.SENTRY_DSN;
  if (dsn) {
    console.error('[Sentry] Captured API error:', err.message, {
      url: req.url,
      method: req.method,
      userId: (req as any).user?.id,
    });
  }
  next(err);
}
