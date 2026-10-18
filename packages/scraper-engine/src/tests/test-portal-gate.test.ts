import assert from 'node:assert/strict';

/**
 * The local test portal is registered by a module-level side effect in
 * ../config, so its gate can only be observed by importing the module with the
 * environment already set. portal-registry.test.ts covers the flag-off case
 * (the common one); this file covers flag-on, with a fresh module registry.
 */

async function main(): Promise<void> {
  console.log('--- Starting Local Test Portal Gate Tests ---');


  // 1. Flag on + a private URL: the portal is registered, every real portal is
  //    untouched, and the cron is the one the operator asked for.
  {
    process.env.PORTAL_TEST_ENABLED = 'true';
    process.env.TEST_PORTAL_URL = 'http://mock-portal:18080';
    process.env.PORTAL_TEST_CRON = '*/2 * * * *';

    const { PORTAL_CONFIGS, getPortalConfig, getEnabledPortals } = await import('../config');

    const portal = getPortalConfig('testportal');
    assert.ok(portal, 'PORTAL_TEST_ENABLED=true must register the local test portal');
    assert.equal(portal!.name, 'LocalTestPortal');
    assert.equal(portal!.url, 'http://mock-portal:18080');
    assert.equal(portal!.cronExpression, '*/2 * * * *');
    assert.equal(portal!.enabled, true);
    assert.equal(portal!.maxPages, 1);
    assert.equal(portal!.usePlaywright, false);

    assert.equal(PORTAL_CONFIGS.length, 14, '13 real portals plus the test portal');
    assert.equal(getEnabledPortals().length, 14);

    // The scraper class must resolve, or a scheduled firing would die with
    // "No scraper class for: testportal".
    const { getAllScraperClasses } = await import('../index');
    assert.ok((getAllScraperClasses() as Record<string, unknown>).testportal);

    console.log('✓ PORTAL_TEST_ENABLED=true registers exactly one extra portal, cron and class intact');
  }

  // 2. The scraper builds its URLs from the configured base and nowhere else.
  {
    const { TestPortalScraper } = await import('../scrapers/test-portal-scraper');
    const scraper = new TestPortalScraper({ baseUrl: 'http://mock-portal:18080' });

    assert.equal(scraper.buildListingUrl(1), 'http://mock-portal:18080/tenders?page=1');
    assert.equal(scraper.buildDetailUrl('TEST-0001'), 'http://mock-portal:18080/tenders/TEST-0001');
    assert.equal(scraper.portalName, 'LocalTestPortal');

    console.log('✓ TestPortalScraper addresses only the configured local base URL');
  }

  // 3. The listing/detail parsers understand the mock portal's markup.
  {
    const { TestPortalScraper } = await import('../scrapers/test-portal-scraper');
    const scraper = new TestPortalScraper({ baseUrl: 'http://127.0.0.1:18080' });

    const listing = scraper.parseTenderList(
      '<table class="tenderListTable"><tbody>' +
        '<tr><td>TEST-0001</td><td>Mock tender 1</td><td>Test Dept</td><td>Rs. 5 Lakh</td>' +
        '<td>01-01-2026</td><td>31-12-2026</td></tr>' +
        '<tr><td></td><td>no id, must be skipped</td><td>x</td><td>y</td></tr>' +
        '</tbody></table>',
    );

    assert.equal(listing.length, 1, 'rows without a source id must be dropped');
    assert.equal(listing[0].sourceId, 'TEST-0001');
    assert.equal(listing[0].title, 'Mock tender 1');
    assert.equal(listing[0].sourcePortal, 'LocalTestPortal');

    const detail = scraper.parseTenderDetail(
      '<table class="detailTable">' +
        '<tr><td>title</td><td>Mock tender TEST-0001</td></tr>' +
        '<tr><td>organization</td><td>Test Organization</td></tr>' +
        '<tr><td>estimated value</td><td>Rs. 10 Lakh</td></tr>' +
        '</table>',
    );

    assert.equal(detail.title, 'Mock tender TEST-0001');
    assert.equal(detail.organization, 'Test Organization');
    assert.equal(detail.estimatedValue, 1000000);

    console.log('✓ Parsers read the mock portal markup (listing rows, detail fields, currency)');
  }

  console.log('--- All Local Test Portal Gate Tests Passed ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
