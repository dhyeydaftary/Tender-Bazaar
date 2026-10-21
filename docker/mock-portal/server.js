/**
 * Mock tender portal — a local stand-in for a government e-procurement site.
 *
 * Used only by the isolated staging verification stack so that scheduler,
 * queue, retry and locking behaviour can be exercised end to end without
 * sending a single request to a real portal. It has no dependencies beyond
 * Node's standard library, so it runs on a bare `node:20-alpine` image.
 *
 * Endpoints
 *   GET /tenders?page=N        listing page (table.tenderListTable)
 *   GET /tenders/{id}          detail page  (table.detailTable)
 *   GET /health                { ok: true }
 *   GET /__control/state       current switches + request counters
 *   GET /__control/fail?mode=  none | 500 | hang   (applies to /tenders*)
 *   GET /__control/reset       clear switches and counters
 *
 * PORT          listen port (default 18080)
 * MOCK_TENDERS  how many tenders the listing page returns (default 3)
 */

'use strict';

const http = require('node:http');

const PORT = Number(process.env.PORT || 18080);
const TENDER_COUNT = Number(process.env.MOCK_TENDERS || 3);

/** 'none' serves normally; '500' errors; 'hang' never responds. */
let failMode = 'none';
const counters = { listing: 0, detail: 0, control: 0 };

const pad = (n) => String(n).padStart(4, '0');

function listingPage(page) {
  // Only page 1 has content: the scraper stops paginating on an empty page,
  // which keeps a run short and deterministic.
  const rows =
    page !== 1
      ? ''
      : Array.from({ length: TENDER_COUNT }, (_, i) => {
          const id = `TEST-${pad(i + 1)}`;
          return (
            `<tr><td>${id}</td><td>Mock tender ${i + 1} for scheduler verification</td>` +
            `<td>Test Department of Public Works</td><td>Rs. ${(i + 1) * 5} Lakh</td>` +
            `<td>01-01-2026</td><td>31-12-2026</td></tr>`
          );
        }).join('');

  return (
    `<!doctype html><html><body><h1>Mock portal — listing page ${page}</h1>` +
    `<table class="tenderListTable"><tbody>${rows}</tbody></table></body></html>`
  );
}

function detailPage(id) {
  return (
    `<!doctype html><html><body><h1>Mock tender ${id}</h1>` +
    `<table class="detailTable">` +
    `<tr><td>title</td><td>Mock tender ${id} for scheduler verification</td></tr>` +
    `<tr><td>description</td><td>Synthetic tender served by the local mock portal.</td></tr>` +
    `<tr><td>organization</td><td>Test Organization</td></tr>` +
    `<tr><td>department</td><td>Test Department of Public Works</td></tr>` +
    `<tr><td>district</td><td>Test District</td></tr>` +
    `<tr><td>estimated value</td><td>Rs. 10 Lakh</td></tr>` +
    `<tr><td>emd</td><td>Rs. 25,000</td></tr>` +
    `</table></body></html>`
  );
}

function send(res, status, body, type) {
  res.writeHead(status, {
    'Content-Type': type || 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const path = url.pathname;

  if (path === '/health') {
    return send(res, 200, JSON.stringify({ ok: true, failMode, counters }), 'application/json');
  }

  if (path.startsWith('/__control/')) {
    counters.control++;
    if (path === '/__control/fail') {
      const mode = url.searchParams.get('mode') || 'none';
      if (!['none', '500', 'hang'].includes(mode)) {
        return send(res, 400, JSON.stringify({ error: 'mode must be none|500|hang' }), 'application/json');
      }
      failMode = mode;
      console.log(`[mock-portal] failMode=${failMode}`);
      return send(res, 200, JSON.stringify({ failMode }), 'application/json');
    }
    if (path === '/__control/reset') {
      failMode = 'none';
      counters.listing = 0;
      counters.detail = 0;
      console.log('[mock-portal] reset');
      return send(res, 200, JSON.stringify({ failMode, counters }), 'application/json');
    }
    if (path === '/__control/state') {
      return send(res, 200, JSON.stringify({ failMode, counters }), 'application/json');
    }
    return send(res, 404, JSON.stringify({ error: 'unknown control endpoint' }), 'application/json');
  }

  if (path === '/tenders' || path.startsWith('/tenders/')) {
    if (failMode === 'hang') {
      console.log(`[mock-portal] hanging ${path}`);
      return; // deliberately never responds
    }
    if (failMode === '500') {
      console.log(`[mock-portal] 500 for ${path}`);
      return send(res, 500, '<html><body>Mock portal failure</body></html>');
    }

    if (path === '/tenders') {
      const page = Number(url.searchParams.get('page') || 1);
      counters.listing++;
      console.log(`[mock-portal] listing page=${page}`);
      return send(res, 200, listingPage(page));
    }

    const id = decodeURIComponent(path.slice('/tenders/'.length));
    counters.detail++;
    console.log(`[mock-portal] detail id=${id}`);
    return send(res, 200, detailPage(id));
  }

  send(res, 404, '<html><body>not found</body></html>');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[mock-portal] listening on 0.0.0.0:${PORT} with ${TENDER_COUNT} tenders`);
});
