import { Client } from '@elastic/elasticsearch';
import { env } from './env';

export const esClient = new Client({
  node: env.ELASTICSEARCH_URL,
  // Bound how long a single search may hang. The default is 30s, which meant a
  // stalled cluster held the request open for ~30s before failing the response.
  requestTimeout: 10000,
  maxRetries: 2,
});

export default esClient;
