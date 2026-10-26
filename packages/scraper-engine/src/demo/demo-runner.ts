/**
 * Demo run simulator
 *
 * Drives a simulated run through the same lifecycle the real engine records —
 * PENDING → RUNNING → COMPLETED — at a human pace, persisting counters after
 * every simulated page so the admin dashboard's existing polling shows live
 * progress.
 *
 * What a simulated run reports, and why:
 *   totalFound / pagesScraped  plausible listing counts for the demo portal
 *   newTenders = 0             nothing is written to Tender, so claiming new
 *   updatedTenders = 0         or updated tenders would be false
 *   duplicates = totalFound    every listing "seen" is treated as already
 *                              known, which is what an idempotent re-scrape of
 *                              an indexed portal reports
 *
 * This module performs no I/O of its own: it only calls the injected store,
 * clock and random source. It imports nothing that can reach the network.
 */

import type { DemoPortal } from './demo-portals';
import type { RunProgress, RunTotals } from './demo-store';

export type DemoTrigger = 'manual' | 'schedule';

/** The subset of DemoRunStore the runner needs; tests substitute a fake. */
export interface DemoRunStoreLike {
  isPortalEnabled(portalName: string): Promise<boolean>;
  createRun(portalName: string, trigger: DemoTrigger, maxPages: number): Promise<string>;
  startRun(runId: string): Promise<void>;
  recordProgress(runId: string, progress: RunProgress): Promise<void>;
  completeRun(runId: string, portalName: string, totals: RunTotals, note?: string | null): Promise<void>;
  failRun(runId: string, portalName: string, message: string, progress: RunProgress): Promise<void>;
  cancelRun(runId: string, reason: string): Promise<void>;
}

export interface DemoRunnerOptions {
  store: DemoRunStoreLike;
  portals: readonly DemoPortal[];
  /** Simulated runs executing at once; further runs wait as PENDING. */
  concurrency: number;
  /** Delay before a queued run starts (ms, inclusive range). */
  startDelayMs: [number, number];
  /** Delay per simulated page (ms, inclusive range). */
  pageDelayMs: [number, number];
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
  onError?: (portalName: string, err: unknown) => void;
  /**
   * Every Nth run of a portal fails partway with a [Simulated] message
   * (0 = never). Counted per portal within this process, so the pattern is
   * predictable for a presentation.
   */
  failureEvery?: number;
  /** Every Nth run of a portal completes with 1–2 [Simulated] page errors (0 = never). */
  pageErrorsEvery?: number;
}

/** Hard cap: never more than this many simulated runs execute at once. */
export const MAX_DEMO_CONCURRENCY = 2;

export const SIMULATED_NOTE = 'Demo run — no external portal was contacted.';

export function simulatedFailureMessage(page: number): string {
  return `[Simulated] Portal responded with HTTP 503 Service Unavailable on listing page ${page}. ${SIMULATED_NOTE}`;
}

export function simulatedPageErrorMessage(count: number): string {
  return `[Simulated] ${count} listing page${count === 1 ? '' : 's'} timed out and ${count === 1 ? 'was' : 'were'} skipped. ${SIMULATED_NOTE}`;
}

/** What a run will simulate, decided when it is queued. */
export interface RunPlan {
  /** Page on which the run fails, or null for a run that completes. */
  failAtPage: number | null;
  /** Pages that error and are skipped (only for completing runs). */
  errorPages: number[];
}

/** Deterministic plan for the n-th run (1-based) of a portal with `pages` pages. */
export function planRun(n: number, pages: number, failureEvery: number, pageErrorsEvery: number): RunPlan {
  if (failureEvery > 0 && n % failureEvery === 0) {
    return { failAtPage: Math.max(1, Math.ceil(pages / 2)), errorPages: [] };
  }
  if (pageErrorsEvery > 0 && n % pageErrorsEvery === 0 && pages >= 2) {
    const count = 1 + (n % 2); // alternate 1 and 2 error pages
    const candidates = [2, pages - 1].filter((p, i, all) => p >= 1 && p <= pages && all.indexOf(p) === i);
    return { failAtPage: null, errorPages: candidates.slice(0, count) };
  }
  return { failAtPage: null, errorPages: [] };
}

export type TriggerResult =
  | { status: 'queued'; runId: string; portal: string }
  | { status: 'already-running'; runId: string; portal: string }
  | { status: 'disabled'; portal: string }
  | { status: 'unknown-portal' }
  | { status: 'stopping' };

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class DemoRunner {
  private readonly random: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  /** portalName → runId for runs that are PENDING or RUNNING. */
  private readonly active = new Map<string, string>();
  private readonly inFlight = new Set<Promise<void>>();
  private readonly waiting: Array<() => void> = [];
  private running = 0;
  private stopping = false;
  private completedRuns = 0;
  private failedRuns = 0;
  /** portalName → number of runs queued so far in this process. */
  private readonly runCounts = new Map<string, number>();

  constructor(private readonly options: DemoRunnerOptions) {
    this.random = options.random ?? Math.random;
    this.sleep = options.sleep ?? defaultSleep;
  }

  get activeRunCount(): number {
    return this.active.size;
  }

  get completedRunCount(): number {
    return this.completedRuns;
  }

  get failedRunCount(): number {
    return this.failedRuns;
  }

  isStopping(): boolean {
    return this.stopping;
  }

  /**
   * Request a simulated run. Mirrors the real engine's per-portal lock: a
   * second request while one is queued or running is refused, not duplicated.
   * Scheduled runs skip a portal an administrator disabled; manual runs are an
   * explicit instruction, matching the real engine (api-server already rejects
   * manual runs for disabled portals before calling here).
   */
  async trigger(key: string, trigger: DemoTrigger): Promise<TriggerResult> {
    if (this.stopping) return { status: 'stopping' };

    const portal = this.options.portals.find((p) => p.key === key);
    if (!portal) return { status: 'unknown-portal' };

    const existing = this.active.get(portal.name);
    if (existing) return { status: 'already-running', runId: existing, portal: portal.name };

    // Reserve the lock before the first await so concurrent requests cannot both pass.
    this.active.set(portal.name, 'pending');
    const pages = this.between(portal.pages);
    let runId: string;
    try {
      if (trigger === 'schedule' && !(await this.options.store.isPortalEnabled(portal.name))) {
        this.active.delete(portal.name);
        return { status: 'disabled', portal: portal.name };
      }
      runId = await this.options.store.createRun(portal.name, trigger, pages);
    } catch (err) {
      this.active.delete(portal.name);
      throw err;
    }
    this.active.set(portal.name, runId);

    const n = (this.runCounts.get(portal.name) ?? 0) + 1;
    this.runCounts.set(portal.name, n);
    const plan = planRun(n, pages, this.options.failureEvery ?? 0, this.options.pageErrorsEvery ?? 0);

    const execution = this.execute(portal, runId, pages, plan).finally(() => {
      this.active.delete(portal.name);
      this.inFlight.delete(execution);
    });
    this.inFlight.add(execution);

    return { status: 'queued', runId, portal: portal.name };
  }

  /** Resolves when every queued or running simulation has finished. */
  async whenIdle(): Promise<void> {
    while (this.inFlight.size > 0) {
      await Promise.all([...this.inFlight]);
    }
  }

  /** Stop accepting runs and cancel the ones in progress. */
  async stop(): Promise<void> {
    this.stopping = true;
    this.waiting.splice(0).forEach((release) => release());
    await this.whenIdle();
  }

  private async execute(portal: DemoPortal, runId: string, pages: number, plan: RunPlan): Promise<void> {
    await this.acquireSlot();
    try {
      await this.sleep(this.between(this.options.startDelayMs));
      if (this.stopping) {
        await this.options.store.cancelRun(runId, 'Simulated run cancelled: the demo scraper is shutting down.');
        return;
      }

      await this.options.store.startRun(runId);

      const progress: RunProgress = { pagesScraped: 0, totalFound: 0, duplicates: 0, errors: 0 };
      for (let page = 1; page <= pages; page += 1) {
        await this.sleep(this.between(this.options.pageDelayMs));
        if (this.stopping) {
          await this.options.store.cancelRun(runId, 'Simulated run cancelled: the demo scraper is shutting down.');
          return;
        }
        if (plan.failAtPage === page) {
          await this.options.store.failRun(runId, portal.name, simulatedFailureMessage(page), { ...progress });
          this.failedRuns += 1;
          return;
        }
        if (plan.errorPages.includes(page)) {
          // A skipped page: counted as an error, contributes no listings.
          progress.errors += 1;
          await this.options.store.recordProgress(runId, { ...progress });
          continue;
        }
        const found = this.between(portal.itemsPerPage);
        progress.pagesScraped += 1;
        progress.totalFound += found;
        progress.duplicates += found;
        await this.options.store.recordProgress(runId, { ...progress });
      }

      await this.options.store.completeRun(
        runId,
        portal.name,
        { ...progress, newTenders: 0, updatedTenders: 0 },
        progress.errors > 0 ? simulatedPageErrorMessage(progress.errors) : null,
      );
      this.completedRuns += 1;
    } catch (err) {
      this.options.onError?.(portal.name, err);
      await this.options.store
        .cancelRun(runId, 'Simulated run stopped: the demo scraper hit an internal error.')
        .catch(() => undefined);
    } finally {
      this.releaseSlot();
    }
  }

  private async acquireSlot(): Promise<void> {
    const limit = Math.min(MAX_DEMO_CONCURRENCY, Math.max(1, this.options.concurrency));
    if (this.running < limit || this.stopping) {
      this.running += 1;
      return;
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.running += 1;
  }

  private releaseSlot(): void {
    this.running -= 1;
    this.waiting.shift()?.();
  }

  private between([min, max]: [number, number]): number {
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    return lo + Math.floor(this.random() * (hi - lo + 1));
  }
}
