/**
 * Structured Logger for Scraper Engine
 *
 * Lightweight structured logger with JSON output for production
 * and colorized console output for development.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  portal?: string;
  message: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m',  // Cyan
  info: '\x1b[32m',   // Green
  warn: '\x1b[33m',   // Yellow
  error: '\x1b[31m',  // Red
};

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

// ---------------------------------------------------------------------------
// Logger class
// ---------------------------------------------------------------------------

export class Logger {
  private portal: string;
  private minLevel: number;
  private isProduction: boolean;

  constructor(portal: string, level?: LogLevel) {
    this.portal = portal;
    this.minLevel = LOG_LEVELS[level ?? (process.env.LOG_LEVEL as LogLevel) ?? 'info'];
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta);
  }

  /**
   * Create a child logger with additional context.
   */
  child(extraPortal: string): Logger {
    return new Logger(`${this.portal}:${extraPortal}`);
  }

  /**
   * Log a scraping run summary.
   */
  runSummary(stats: {
    totalFound: number;
    newTenders: number;
    updatedTenders: number;
    errors: number;
    duration: number;
    pages?: number;
  }): void {
    this.info('Scraping run complete', {
      totalFound: stats.totalFound,
      newTenders: stats.newTenders,
      updatedTenders: stats.updatedTenders,
      errors: stats.errors,
      durationMs: stats.duration,
      durationFormatted: this.formatDuration(stats.duration),
      ...(stats.pages !== undefined ? { pagesScraped: stats.pages } : {}),
    });
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (LOG_LEVELS[level] < this.minLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      portal: this.portal,
      message,
      ...meta,
    };

    if (this.isProduction) {
      this.writeJson(entry);
    } else {
      this.writeConsole(level, entry);
    }
  }

  private writeJson(entry: LogEntry): void {
    const stream = entry.level === 'error' ? process.stderr : process.stdout;
    stream.write(JSON.stringify(entry) + '\n');
  }

  private writeConsole(level: LogLevel, entry: LogEntry): void {
    const color = LEVEL_COLORS[level];
    const time = DIM + entry.timestamp.substring(11, 23) + RESET;
    const lvl = color + BOLD + level.toUpperCase().padEnd(5) + RESET;
    const portal = `\x1b[35m[${entry.portal}]${RESET}`;
    const msg = entry.message;

    // Extract meta (everything except timestamp, level, portal, message)
    const { timestamp: _, level: __, portal: ___, message: ____, ...meta } = entry;
    const metaStr = Object.keys(meta).length > 0
      ? ` ${DIM}${JSON.stringify(meta)}${RESET}`
      : '';

    const stream = level === 'error' ? process.stderr : process.stdout;
    stream.write(`${time} ${lvl} ${portal} ${msg}${metaStr}\n`);
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60_000);
    const secs = Math.round((ms % 60_000) / 1000);
    return `${mins}m ${secs}s`;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a logger for a specific portal/module.
 */
export function createLogger(portal: string, level?: LogLevel): Logger {
  return new Logger(portal, level);
}

/**
 * Root logger for the scraper engine.
 */
export const rootLogger = new Logger('ScraperEngine');
