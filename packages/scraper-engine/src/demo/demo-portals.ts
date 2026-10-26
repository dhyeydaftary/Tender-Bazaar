/**
 * Demo portal registry
 *
 * The demo scraper simulates scraping activity for client presentations. It
 * never contacts a real portal, so its portals are deliberately NOT the real
 * registry entries in config/index.ts: every name carries the `-Demo` suffix,
 * which keeps simulated ScraperHealth rows and ScrapingRun history visibly and
 * queryably separate from genuine scraper activity in the same database.
 *
 * api-server derives the control-API key with `portalName.toLowerCase()`
 * (queue/scraper-job-publisher.ts), so each key here is exactly that.
 */

export const DEMO_PORTAL_SUFFIX = '-Demo';

export interface DemoPortal {
  /** ScraperHealth.portalName — always ends in DEMO_PORTAL_SUFFIX. */
  name: string;
  /** Control-API key: name.toLowerCase(). */
  key: string;
  /** Display label used in logs. Not a URL: nothing is ever fetched. */
  label: string;
  /** Simulated listing pages per run (inclusive range). */
  pages: [number, number];
  /** Simulated listings discovered per page (inclusive range). */
  itemsPerPage: [number, number];
  /** UTC cron used only when DEMO_SCHEDULE_ENABLED=true. */
  cronExpression: string;
}

function portal(
  base: string,
  label: string,
  pages: [number, number],
  itemsPerPage: [number, number],
  cronExpression: string,
): DemoPortal {
  const name = `${base}${DEMO_PORTAL_SUFFIX}`;
  return { name, key: name.toLowerCase(), label, pages, itemsPerPage, cronExpression };
}

export const DEMO_PORTALS: readonly DemoPortal[] = [
  portal('GeM', 'Government e-Marketplace (simulated)', [8, 14], [18, 25], '5 */2 * * *'),
  portal('CPPP', 'Central Public Procurement Portal (simulated)', [6, 12], [15, 20], '20 */3 * * *'),
  portal('eProcure', 'eProcure (simulated)', [5, 10], [12, 20], '35 */4 * * *'),
  portal('Maharashtra', 'Maharashtra e-Tendering (simulated)', [4, 9], [10, 18], '50 */4 * * *'),
  portal('Gujarat', 'Gujarat nProcure (simulated)', [4, 8], [10, 16], '10 */6 * * *'),
  portal('Rajasthan', 'Rajasthan e-Procurement (simulated)', [3, 7], [8, 15], '40 */6 * * *'),
];

export function isDemoPortalName(portalName: string): boolean {
  return portalName.endsWith(DEMO_PORTAL_SUFFIX) && portalName.length > DEMO_PORTAL_SUFFIX.length;
}

export function getDemoPortal(key: string): DemoPortal | undefined {
  return DEMO_PORTALS.find((p) => p.key === key);
}
