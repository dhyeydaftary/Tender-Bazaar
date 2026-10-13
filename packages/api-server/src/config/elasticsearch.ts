import { Client } from '@elastic/elasticsearch';
import { env } from './env';

export const esClient = new Client({
  node: env.ELASTICSEARCH_URL,
  requestTimeout: 1000,
  maxRetries: 0,
});

let isAvailable = false;
let lastCheckTime = 0;
const CHECK_INTERVAL = 60000; // Probe at most once every 60s

export async function checkElasticsearch(): Promise<boolean> {
  const now = Date.now();
  if (now - lastCheckTime < CHECK_INTERVAL) {
    return isAvailable;
  }
  lastCheckTime = now;
  try {
    await esClient.ping();
    isAvailable = true;
  } catch {
    isAvailable = false;
  }
  return isAvailable;
}

export function isElasticsearchAlive(): boolean {
  return isAvailable;
}

export function markElasticsearchDown() {
  isAvailable = false;
  lastCheckTime = Date.now();
}

export default esClient;
