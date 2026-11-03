/**
 * Dependency health report for GET /health and GET /api/v1/health.
 *
 * Dependencies are not equal. PostgreSQL and Redis are ESSENTIAL: without the
 * database nothing works, and Redis holds token revocations, OTP state and the
 * job queues, so the API refuses requests rather than guessing when it is
 * gone. Elasticsearch is OPTIONAL: tender search falls back to PostgreSQL
 * whenever it is unreachable or switched off (ELASTICSEARCH_ENABLED=false).
 *
 *   status 'ok'        every essential dependency healthy, search on Elasticsearch
 *   status 'degraded'  every essential dependency healthy, search on PostgreSQL
 *   status 'unhealthy' an essential dependency is down
 *
 * Only 'unhealthy' is an HTTP 503. The report used to answer 503 whenever
 * Elasticsearch was down, which on a platform that restarts or stops routing
 * to "unhealthy" instances would have taken a working API out of service over
 * its optional search index.
 *
 * Each probe resolves when its dependency is usable and rejects otherwise; the
 * Elasticsearch probe may also resolve with a problem description (for a
 * reachable cluster whose tender index is missing). The report never marks a
 * dependency healthy merely because the API answered.
 */
export type ServiceHealth = 'healthy' | 'unhealthy' | 'disabled' | string;

export type HealthStatus = 'ok' | 'degraded' | 'unhealthy';

export interface HealthReport {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    elasticsearch: ServiceHealth;
  };
  /** Which backend tender search is using right now. */
  search: 'elasticsearch' | 'postgresql';
}

export interface HealthProbes {
  database: () => Promise<unknown>;
  redis: () => Promise<unknown>;
  /** Resolves 'healthy' or a problem description; rejects when unreachable. */
  elasticsearch: () => Promise<ServiceHealth>;
  /** When false, Elasticsearch is not probed and reported as 'disabled'. Default true. */
  elasticsearchEnabled?: boolean;
}

/** Dependencies whose failure makes the whole API unhealthy. */
export const ESSENTIAL_SERVICES = ['database', 'redis'] as const;

async function probe(check: () => Promise<unknown>): Promise<ServiceHealth> {
  try {
    await check();
    return 'healthy';
  } catch {
    return 'unhealthy';
  }
}

export async function buildHealthReport(probes: HealthProbes, uptime = process.uptime()): Promise<HealthReport> {
  const elasticsearchEnabled = probes.elasticsearchEnabled ?? true;
  const [database, redis, elasticsearch] = await Promise.all([
    probe(probes.database),
    probe(probes.redis),
    elasticsearchEnabled
      ? probes.elasticsearch().catch(() => 'unhealthy' as const)
      : Promise.resolve('disabled' as const),
  ]);
  const services = { database, redis, elasticsearch };

  const essentialDown = ESSENTIAL_SERVICES.some((name) => services[name] !== 'healthy');
  const searchOnElasticsearch = elasticsearch === 'healthy';

  return {
    status: essentialDown ? 'unhealthy' : searchOnElasticsearch ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime,
    services,
    search: searchOnElasticsearch ? 'elasticsearch' : 'postgresql',
  };
}

/** The HTTP status for a report: only an essential failure is a 503. */
export function healthHttpStatus(report: Pick<HealthReport, 'status'>): 200 | 503 {
  return report.status === 'unhealthy' ? 503 : 200;
}
