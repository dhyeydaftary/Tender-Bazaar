// ===========================================================================
// @tenderbazaar/scraper-engine — Tender scraping infrastructure
//
// Production-grade scraping system for 30+ Indian government tender portals.
// ===========================================================================

// ── Base scraper class and types ────────────────────────────────────────────

export {
  BaseScraper,
  type ScrapedTender,
  type FetchOptions,
  type PlaywrightOptions,
  type ScrapeResult,
} from './scrapers/base-scraper';

// ── HTTP client factory ─────────────────────────────────────────────────────

export {
  createHttpClient,
  createGovPortalClient,
  type HttpClientConfig,
} from './scrapers/http-client';

// ── Rate limiter ────────────────────────────────────────────────────────────

export {
  RateLimiter,
  createRateLimiter,
  type RateLimiterConfig,
  type RequestStats,
} from './scrapers/rate-limiter';

// ── Portal scrapers — Central ───────────────────────────────────────────────

import { GemScraper } from './scrapers/gem-scraper';
import { CpppScraper } from './scrapers/cppp-scraper';
import { EProcureScraper } from './scrapers/eprocure-scraper';

export { GemScraper, CpppScraper, EProcureScraper };

// ── Portal scrapers — State ─────────────────────────────────────────────────

import {
  GujaratScraper,
  MaharashtraScraper,
  RajasthanScraper,
  KarnatakaScraper,
  TamilNaduScraper,
  UPScraper,
  MPScraper,
  DelhiScraper,
  KeralaScraper,
  WestBengalScraper,
} from './scrapers/state-scrapers';

export {
  GujaratScraper,
  MaharashtraScraper,
  RajasthanScraper,
  KarnatakaScraper,
  TamilNaduScraper,
  UPScraper,
  MPScraper,
  DelhiScraper,
  KeralaScraper,
  WestBengalScraper,
};

// ── Convenience: map of all scraper classes by portal key ───────────────────

export function getAllScraperClasses() {
  return {
    gem: GemScraper,
    cppp: CpppScraper,
    eprocure: EProcureScraper,
    gujarat: GujaratScraper,
    maharashtra: MaharashtraScraper,
    rajasthan: RajasthanScraper,
    karnataka: KarnatakaScraper,
    tamilnadu: TamilNaduScraper,
    up: UPScraper,
    mp: MPScraper,
    delhi: DelhiScraper,
    kerala: KeralaScraper,
    westbengal: WestBengalScraper,
  } as const;
}

// ── Pipeline modules ────────────────────────────────────────────────────────

export * from './pipeline/normalizer';
export * from './pipeline/parser';
export * from './pipeline/deduplicator';
export * from './pipeline/categorizer';

// ── Scheduler & Monitor ─────────────────────────────────────────────────────

export * from './scheduler/scheduler';
export * from './scheduler/monitor';

// ── Storage ─────────────────────────────────────────────────────────────────

export { StorageWriter } from './storage/writer';
export type { WriteResult, BatchWriteResult, RunRecord } from './storage/writer';

// ── Configuration ───────────────────────────────────────────────────────────

export { config, PORTAL_CONFIGS, getPortalConfig, getEnabledPortals, getPortalsByType } from './config';
export type { PortalConfig } from './config';

// ── Utilities ───────────────────────────────────────────────────────────────

export { createLogger, rootLogger, Logger } from './utils/logger';
export { scraperEvents } from './utils/events';
export type {
  ScraperEvents,
  RunStartEvent,
  RunCompleteEvent,
  RunErrorEvent,
  TenderEvent,
  TenderDuplicateEvent,
  HealthEvent,
  SystemEvent,
} from './utils/events';

// ── Admin API ───────────────────────────────────────────────────────────────

export { createAdminApi } from './api/server';

// ── Boot message ────────────────────────────────────────────────────────────

import { rootLogger } from './utils/logger';

rootLogger.info('Module loaded', {
  totalScrapers: Object.keys(getAllScraperClasses()).length,
  scrapers: Object.keys(getAllScraperClasses()),
});
