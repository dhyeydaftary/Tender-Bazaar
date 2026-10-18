/**
 * Prints the portal registry's enablement state as JSON, for the parent test.
 *
 * `PORTAL_CONFIGS` resolves `enabled` from the environment at MODULE LOAD, so
 * the only honest way to test the production default is to evaluate the module
 * in a fresh process with a chosen environment. This helper is that process.
 *
 * It only reads configuration — it never constructs a scraper and never makes
 * a network request, so no real portal is contacted.
 */
import { PORTAL_CONFIGS, getEnabledPortals, config } from '../../config';
import { TEST_PORTAL_KEY } from '../../scrapers/test-portal-scraper';

const out = {
  nodeEnv: config.env,
  isProd: config.isProd,
  total: PORTAL_CONFIGS.length,
  // every registered portal and whether it would be scheduled
  all: PORTAL_CONFIGS.map((p) => [p.key, p.enabled] as [string, boolean]),
  enabledKeys: getEnabledPortals().map((p) => p.key),
  // the local mock is registered separately and gated on PORTAL_TEST_ENABLED
  testPortalRegistered: PORTAL_CONFIGS.some((p) => p.key === TEST_PORTAL_KEY),
};

process.stdout.write(JSON.stringify(out));
