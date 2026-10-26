/**
 * Dependency health report for GET /health and GET /api/v1/health.
 *
 * Each probe resolves when its dependency is usable and rejects otherwise;
 * the Elasticsearch probe may also resolve with a problem description (for a
 * reachable cluster whose tender index is missing). The report never marks a
 * dependency healthy merely because the API answered.
 */
export type ServiceHealth = 'healthy' | 'unhealthy' | string;

export interface HealthReport {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    elasticsearch: ServiceHealth;
  };
}

export interface HealthProbes {
  database: () => Promise<unknown>;
  redis: () => Promise<unknown>;
  /** Resolves 'healthy' or a problem description; rejects when unreachable. */
  elasticsearch: () => Promise<ServiceHealth>;
}

async function probe(check: () => Promise<unknown>): Promise<ServiceHealth> {
  try {
    await check();
    return 'healthy';
  } catch {
    return 'unhealthy';
  }
}

export async function buildHealthReport(probes: HealthProbes, uptime = process.uptime()): Promise<HealthReport> {
  const [database, redis, elasticsearch] = await Promise.all([
    probe(probes.database),
    probe(probes.redis),
    probes.elasticsearch().catch(() => 'unhealthy' as const),
  ]);
  const services = { database, redis, elasticsearch };
  const allHealthy = Object.values(services).every((s) => s === 'healthy');
  return {
    status: allHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime,
    services,
  };
}
