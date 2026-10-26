/**
 * Service Health card (Settings → General).
 *
 * Maps GET /api/v1/health to the four rows the card shows. A dependency is only
 * "connected" when the API reported it healthy — the API answering does not
 * make its database, Redis or Elasticsearch healthy — and nothing is shown as
 * connected while the check is still running.
 */

export interface SystemHealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  /** 'healthy', 'unhealthy', or a problem description (e.g. a missing index). */
  services: Partial<Record<'database' | 'redis' | 'elasticsearch', string>> & Record<string, string | undefined>;
}

export type ServiceRowStatus = 'checking' | 'connected' | 'degraded' | 'disconnected' | 'unknown';

export interface ServiceRow {
  name: string;
  status: ServiceRowStatus;
  /** Measured round-trip for the API row; problem text for a degraded dependency. */
  detail: string;
  version: string;
}

export type HealthState =
  | { phase: 'loading' }
  | { phase: 'error' }
  | { phase: 'ready'; report: SystemHealthResponse; latencyMs: number };

export function isHealthReport(value: unknown): value is SystemHealthResponse {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (v.status === 'ok' || v.status === 'degraded') && !!v.services && typeof v.services === 'object';
}

const DEPENDENCIES: ReadonlyArray<{ key: 'database' | 'redis' | 'elasticsearch'; name: string; version: string }> = [
  { key: 'database', name: 'PostgreSQL Database', version: '16-alpine' },
  { key: 'redis', name: 'Redis Cache', version: '7-alpine' },
  { key: 'elasticsearch', name: 'Elasticsearch Engine', version: '8.12.0' },
];

function dependencyStatus(value: string | undefined): { status: ServiceRowStatus; detail: string } {
  if (value === 'healthy') return { status: 'connected', detail: '-' };
  if (value === 'unhealthy') return { status: 'disconnected', detail: 'unreachable' };
  if (typeof value === 'string' && value) return { status: 'degraded', detail: value };
  return { status: 'unknown', detail: 'not reported' };
}

export function serviceRows(state: HealthState): ServiceRow[] {
  const api = { name: 'TenderBazaar API Server', version: '0.1.0' };

  if (state.phase === 'loading') {
    return [...DEPENDENCIES, api].map((s) => ({ name: s.name, version: s.version, status: 'checking', detail: '-' }));
  }

  if (state.phase === 'error') {
    // The API could not be reached, so nothing is known about what is behind it.
    return [
      ...DEPENDENCIES.map((s) => ({ name: s.name, version: s.version, status: 'unknown' as const, detail: 'API unreachable' })),
      { ...api, status: 'disconnected', detail: 'unreachable' },
    ];
  }

  return [
    ...DEPENDENCIES.map((s) => ({ name: s.name, version: s.version, ...dependencyStatus(state.report.services?.[s.key]) })),
    // The API answered — that is its own health; its dependencies are listed above.
    { ...api, status: 'connected', detail: `${state.latencyMs} ms` },
  ];
}
