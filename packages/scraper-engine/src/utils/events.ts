/**
 * Scraper Event System
 *
 * Typed event emitter for scraping lifecycle events.
 * Enables decoupled communication between scrapers, scheduler,
 * monitor, and notification systems.
 */

import { EventEmitter } from 'events';

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

export interface ScraperEvents {
  // Run lifecycle
  'run:start': RunStartEvent;
  'run:complete': RunCompleteEvent;
  'run:error': RunErrorEvent;
  'run:cancel': RunCancelEvent;

  // Tender events
  'tender:new': TenderEvent;
  'tender:updated': TenderEvent;
  'tender:duplicate': TenderDuplicateEvent;
  'tender:error': TenderErrorEvent;

  // Page events
  'page:fetched': PageFetchedEvent;
  'page:error': PageErrorEvent;

  // Portal health
  'health:degraded': HealthEvent;
  'health:unhealthy': HealthEvent;
  'health:recovered': HealthEvent;

  // System
  'scheduler:started': SystemEvent;
  'scheduler:stopped': SystemEvent;
  'queue:drained': SystemEvent;
}

export interface RunStartEvent {
  portalName: string;
  runId: string;
  triggeredBy: 'schedule' | 'manual' | 'retry' | 'catchup';
  timestamp: Date;
}

export interface RunCompleteEvent {
  portalName: string;
  runId: string;
  totalFound: number;
  newTenders: number;
  updatedTenders: number;
  duplicates: number;
  errors: number;
  duration: number;
  pagesScraped: number;
  timestamp: Date;
}

export interface RunErrorEvent {
  portalName: string;
  runId: string;
  error: Error;
  duration: number;
  timestamp: Date;
}

export interface RunCancelEvent {
  portalName: string;
  runId: string;
  reason: string;
  timestamp: Date;
}

export interface TenderEvent {
  portalName: string;
  tenderId: string;
  sourceId: string;
  title: string;
  referenceNumber: string;
  estimatedValue?: number;
  state: string;
  category?: string;
  timestamp: Date;
}

export interface TenderDuplicateEvent {
  portalName: string;
  sourceId: string;
  existingTenderId: string;
  matchType: 'exact' | 'fuzzy' | 'corrigendum';
  similarityScore?: number;
  timestamp: Date;
}

export interface TenderErrorEvent {
  portalName: string;
  sourceId: string;
  error: Error;
  stage: 'fetch' | 'parse' | 'normalize' | 'save';
  timestamp: Date;
}

export interface PageFetchedEvent {
  portalName: string;
  url: string;
  statusCode: number;
  responseTimeMs: number;
  contentLength: number;
  page: number;
  timestamp: Date;
}

export interface PageErrorEvent {
  portalName: string;
  url: string;
  error: Error;
  attempt: number;
  maxAttempts: number;
  timestamp: Date;
}

export interface HealthEvent {
  portalName: string;
  previousStatus: string;
  newStatus: string;
  consecutiveFailures: number;
  errorRate: number;
  lastError?: string;
  timestamp: Date;
}

export interface SystemEvent {
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Typed Event Emitter
// ---------------------------------------------------------------------------

class ScraperEventEmitter extends EventEmitter {
  emit<K extends keyof ScraperEvents>(event: K, data: ScraperEvents[K]): boolean {
    return super.emit(event, data);
  }

  on<K extends keyof ScraperEvents>(event: K, listener: (data: ScraperEvents[K]) => void): this {
    return super.on(event, listener);
  }

  once<K extends keyof ScraperEvents>(event: K, listener: (data: ScraperEvents[K]) => void): this {
    return super.once(event, listener);
  }

  off<K extends keyof ScraperEvents>(event: K, listener: (data: ScraperEvents[K]) => void): this {
    return super.off(event, listener);
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

/**
 * Global scraper event bus.
 * All scraping components emit and listen on this shared instance.
 */
export const scraperEvents = new ScraperEventEmitter();

// Increase max listeners for production use (many portal scrapers)
scraperEvents.setMaxListeners(50);
