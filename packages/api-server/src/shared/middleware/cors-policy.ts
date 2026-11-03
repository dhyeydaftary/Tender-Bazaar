/**
 * Which browser origins may call the API with credentials.
 *
 * Production trusts exactly the configured origins: FRONTEND_URL, ADMIN_URL
 * and CORS_ORIGINS (validated at startup by validateDeploymentEnvironment;
 * no wildcards). The local origins below, and any http://localhost:* or
 * http://127.0.0.1:* port, are added only for an explicit
 * NODE_ENV=development, so a server that forgot to set NODE_ENV does not
 * accept credentialed calls from pages on a visitor's own machine.
 *
 * Kept free of the env module so it can be unit-tested with plain inputs.
 */

export const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3002',
];

export interface CorsPolicyInput {
  frontendUrl?: string;
  adminUrl?: string;
  extraOrigins?: string[];
  developmentShortcuts: boolean;
}

export interface CorsPolicy {
  allowedOrigins: string[];
  allowLoopbackOrigins: boolean;
}

/** Origins are compared exactly, so a configured trailing slash is dropped. */
function normaliseOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '');
}

export function buildCorsPolicy(input: CorsPolicyInput): CorsPolicy {
  const configured = [input.frontendUrl, input.adminUrl, ...(input.extraOrigins ?? [])]
    .filter((origin): origin is string => typeof origin === 'string' && origin.trim() !== '')
    .map(normaliseOrigin)
    // A wildcard is never a trusted origin, whatever the configuration says.
    .filter((origin) => !origin.includes('*'));

  return {
    allowedOrigins: [...new Set([...configured, ...(input.developmentShortcuts ? DEV_ORIGINS : [])])],
    allowLoopbackOrigins: input.developmentShortcuts,
  };
}

/**
 * Whether a request's Origin header is allowed. Requests without an Origin
 * (server-to-server calls, curl, same-origin navigations) carry no browser
 * credentials across origins and are allowed, as before.
 */
export function isOriginAllowed(policy: CorsPolicy, origin: string | undefined): boolean {
  if (!origin) return true;
  if (policy.allowedOrigins.includes(origin)) return true;
  return (
    policy.allowLoopbackOrigins &&
    (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))
  );
}
