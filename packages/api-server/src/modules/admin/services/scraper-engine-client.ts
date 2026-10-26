/**
 * Scraper engine control-API client.
 *
 * Extracted from scrapersService.triggerScraper so the engine-call decision can
 * be tested without a database. Behaviour for the real engine is unchanged:
 *
 *   2xx  → triggered (stop trying further URLs)
 *   409  → the engine refused: a run is already queued or in progress
 *   401  → token mismatch: stop trying further URLs
 *   else → try the next URL; network errors likewise
 *
 * New: the 2xx body is parsed (best effort) so callers can see the engine's
 * job id and whether the engine is a demo engine (`simulated: true`).
 */

export type EngineRunOutcome =
  | { kind: 'triggered'; baseUrl: string; jobId?: string; simulated: boolean; message?: string }
  | { kind: 'refused'; message?: string }
  | { kind: 'unauthorized' }
  | { kind: 'unreachable' };

export interface EngineStatus {
  reachable: boolean;
  mode: 'demo' | 'live' | 'unknown';
  simulated: boolean;
  schedulerRunning: boolean | null;
  enabledPortals: number | null;
  notice: string | null;
  url: string;
  checkedAt: string;
}

/** The part of a fetch Response this client reads; tests pass plain objects. */
interface EngineResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

type FetchLike = (url: string, init?: RequestInit) => Promise<EngineResponse>;

export function engineBaseUrls(configured: string): string[] {
  return [configured, 'http://tenderbazaar-scraper:4001', 'http://localhost:4001'].filter(
    (url, index, all) => Boolean(url) && all.indexOf(url) === index,
  );
}

export async function requestEngineRun(options: {
  baseUrls: string[];
  registryKey: string;
  token: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}): Promise<EngineRunOutcome> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  for (const baseUrl of options.baseUrls) {
    let response: EngineResponse;
    try {
      response = await fetchImpl(`${baseUrl}/api/portals/${encodeURIComponent(options.registryKey)}/run`, {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(options.timeoutMs ?? 3000),
      });
    } catch {
      continue; // Unreachable on this URL — try the next.
    }

    if (response.ok) {
      const body = (await response.json().catch(() => null)) as {
        data?: { jobId?: unknown; simulated?: unknown; message?: unknown };
      } | null;
      return {
        kind: 'triggered',
        baseUrl,
        jobId: typeof body?.data?.jobId === 'string' ? body.data.jobId : undefined,
        simulated: body?.data?.simulated === true,
        message: typeof body?.data?.message === 'string' ? body.data.message : undefined,
      };
    }
    if (response.status === 409) {
      const body = (await response.json().catch(() => null)) as { error?: { message?: unknown } } | null;
      return {
        kind: 'refused',
        message: typeof body?.error?.message === 'string' ? body.error.message : undefined,
      };
    }
    if (response.status === 401) return { kind: 'unauthorized' };
  }
  return { kind: 'unreachable' };
}

/**
 * Read the engine's public /api/health. A demo engine identifies itself with
 * `mode: 'demo'` / `simulated: true`; the real engine reports neither field.
 */
export async function fetchEngineStatus(options: {
  baseUrl: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}): Promise<EngineStatus> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base: EngineStatus = {
    reachable: false,
    mode: 'unknown',
    simulated: false,
    schedulerRunning: null,
    enabledPortals: null,
    notice: null,
    url: options.baseUrl,
    checkedAt: new Date().toISOString(),
  };
  try {
    const response = await fetchImpl(`${options.baseUrl}/api/health`, {
      signal: AbortSignal.timeout(options.timeoutMs ?? 3000),
    });
    if (!response.ok) return base;
    const body = (await response.json().catch(() => null)) as { data?: Record<string, unknown> } | null;
    const data = body?.data ?? {};
    const simulated = data.simulated === true || data.mode === 'demo';
    return {
      ...base,
      reachable: true,
      mode: simulated ? 'demo' : 'live',
      simulated,
      schedulerRunning: typeof data.schedulerRunning === 'boolean' ? data.schedulerRunning : null,
      enabledPortals: typeof data.enabledPortals === 'number' ? data.enabledPortals : null,
      notice: typeof data.notice === 'string' ? data.notice : null,
    };
  } catch {
    return base;
  }
}
