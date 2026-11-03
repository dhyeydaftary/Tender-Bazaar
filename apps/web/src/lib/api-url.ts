/**
 * The API base URL the browser talks to.
 *
 * NEXT_PUBLIC_API_URL is inlined at build time, and production builds refuse
 * to start without a valid one (see api-url.config.js, run by next.config.js).
 * The localhost default applies only to development (`next dev`); a
 * production bundle that somehow lacks the URL gets `null` and every request
 * fails with API_URL_NOT_CONFIGURED_MESSAGE instead of silently going to the
 * visitor's own machine.
 */

export const LOCAL_DEVELOPMENT_API_URL = 'http://localhost:4000/api/v1';

export const API_URL_NOT_CONFIGURED_MESSAGE =
  'TenderBazaar is misconfigured: NEXT_PUBLIC_API_URL was not set when this app was built.';

export function resolveApiBaseUrl(
  configured: string | undefined,
  nodeEnv: string | undefined,
): string | null {
  const value = (configured ?? '').trim();
  if (value !== '') return value.replace(/\/+$/, '');
  return nodeEnv === 'production' ? null : LOCAL_DEVELOPMENT_API_URL;
}

/**
 * Resolved for this bundle. Written as a literal `process.env.NEXT_PUBLIC_API_URL`
 * so Next.js inlines it.
 */
export const API_BASE_URL = resolveApiBaseUrl(process.env.NEXT_PUBLIC_API_URL, process.env.NODE_ENV);
