export function initSentry() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn || process.env.NODE_ENV !== 'production') return;

  // Note: actual @sentry/nextjs would be configured differently
  // This is a placeholder that logs errors to console in dev
  console.log('[Sentry] Initialized with DSN:', dsn.substring(0, 20) + '...');
}

export function captureException(error: Error, context?: Record<string, unknown>) {
  console.error('[Sentry]', error.message, context);
  // In production with @sentry/nextjs: Sentry.captureException(error, { extra: context })
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  console.log(`[Sentry][${level}]`, message);
}
