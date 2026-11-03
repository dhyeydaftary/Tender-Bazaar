import { env } from './env';

/**
 * Service-to-service authentication for the Python AI service.
 *
 * The AI service used to accept any caller: anyone who could reach it could
 * spend the Anthropic budget. It now requires `Authorization: Bearer
 * <AI_SERVICE_TOKEN>` on every endpoint except /health, and refuses all of
 * them (503) when no token is configured on its side. The API server is the
 * only intended client, so the same secret is configured here and attached to
 * every request. It is a server-side secret only: it never appears in a
 * NEXT_PUBLIC_* variable or in any browser bundle.
 */

/** Minimum length for a production AI_SERVICE_TOKEN. */
export const MIN_AI_SERVICE_TOKEN_LENGTH = 16;

export function isAiServiceTokenConfigured(): boolean {
  return env.AI_SERVICE_TOKEN !== '';
}

/** Headers to send with every AI service request. */
export function aiServiceHeaders(): Record<string, string> {
  if (!isAiServiceTokenConfigured()) return {};
  return { Authorization: `Bearer ${env.AI_SERVICE_TOKEN}` };
}
