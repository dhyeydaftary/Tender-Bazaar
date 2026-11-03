/**
 * Client-side view of the phone sign-in restrictions.
 *
 * The API enforces every limit on each request (five wrong codes lock the
 * number for fifteen minutes, one code per minute, five codes per hour, each
 * code valid for five minutes, a new code voids the previous one). This module
 * turns the API's responses into timers and button states so the page can show
 * the user how long to wait, and keeps them across a refresh so the page does
 * not forget a lockout the server still remembers.
 *
 * Only what the API actually returned is used: `expiresInSeconds` and
 * `resendAfterSeconds` from a successful send, `details.retryAfterSeconds` and
 * `details.attemptsRemaining` from errors. When a figure is absent no countdown
 * is invented; the control stays disabled until the server says otherwise.
 *
 * Pure functions over timestamps (ms since the epoch) so they can be tested
 * with a fixed clock.
 */

export const OTP_STATE_STORAGE_KEY = 'tb_otp_state';

export interface OtpState {
  phone: string;
  /** The current code is valid until this time; null when no code is outstanding. */
  otpExpiresAt: number | null;
  /** Another code may be requested from this time. */
  resendAvailableAt: number | null;
  /** Wrong-code lockout in force until this time. */
  lockedUntil: number | null;
  /** Hourly send limit reached; resend possible from this time (null = unknown wait). */
  sendLimitUntil: number | null;
  /** True when the hourly limit was reported without a usable wait time. */
  sendLimitReached: boolean;
  attemptsRemaining: number | null;
  maxAttempts: number | null;
}

export interface OtpSendResponse {
  message?: unknown;
  expiresInSeconds?: unknown;
  resendAfterSeconds?: unknown;
  maxAttempts?: unknown;
}

export interface OtpApiError {
  code?: unknown;
  details?: unknown;
}

export interface OtpControls {
  /** A code is outstanding and has run out. */
  otpExpired: boolean;
  otpRemainingSeconds: number;
  lockRemainingSeconds: number;
  resendRemainingSeconds: number;
  sendLimitRemainingSeconds: number;
  /** The verify button may be pressed (code completeness is the page's business). */
  canVerify: boolean;
  canResend: boolean;
  resendBlockedBy: 'locked' | 'cooldown' | 'hourly-limit' | null;
}

export function emptyOtpState(phone: string): OtpState {
  return {
    phone,
    otpExpiresAt: null,
    resendAvailableAt: null,
    lockedUntil: null,
    sendLimitUntil: null,
    sendLimitReached: false,
    attemptsRemaining: null,
    maxAttempts: null,
  };
}

function positiveSeconds(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** A successful send: a fresh code, a fresh attempt budget, a resend cooldown. */
export function applySendSuccess(state: OtpState, response: OtpSendResponse, now: number): OtpState {
  const expires = positiveSeconds(response.expiresInSeconds);
  const resend = positiveSeconds(response.resendAfterSeconds);
  const maxAttempts = positiveSeconds(response.maxAttempts);
  return {
    ...state,
    otpExpiresAt: expires === null ? null : now + expires * 1000,
    resendAvailableAt: resend === null ? null : now + resend * 1000,
    lockedUntil: null,
    sendLimitUntil: null,
    sendLimitReached: false,
    maxAttempts,
    attemptsRemaining: maxAttempts,
  };
}

/** An error from send or verify, mapped by its code. Unknown codes change nothing. */
export function applyApiError(state: OtpState, error: OtpApiError, now: number): OtpState {
  const details = (error.details ?? {}) as Record<string, unknown>;
  const retryAfter = positiveSeconds(details.retryAfterSeconds);

  switch (error.code) {
    case 'OTP_LOCKED':
      return {
        ...state,
        // The server voided the code when it locked the number.
        otpExpiresAt: null,
        attemptsRemaining: 0,
        lockedUntil: retryAfter === null ? null : now + retryAfter * 1000,
      };
    case 'OTP_COOLDOWN':
      return { ...state, resendAvailableAt: retryAfter === null ? state.resendAvailableAt : now + retryAfter * 1000 };
    case 'OTP_TOO_MANY_REQUESTS':
      return {
        ...state,
        sendLimitReached: true,
        sendLimitUntil: retryAfter === null ? null : now + retryAfter * 1000,
      };
    case 'INVALID_OTP': {
      const remaining = details.attemptsRemaining;
      return {
        ...state,
        attemptsRemaining:
          typeof remaining === 'number' && Number.isFinite(remaining) ? Math.max(0, remaining) : state.attemptsRemaining,
      };
    }
    default:
      return state;
  }
}

function remaining(at: number | null, now: number): number {
  if (at === null) return 0;
  return Math.max(0, Math.ceil((at - now) / 1000));
}

export function deriveOtpControls(state: OtpState, now: number): OtpControls {
  const lockRemainingSeconds = remaining(state.lockedUntil, now);
  const resendRemainingSeconds = remaining(state.resendAvailableAt, now);
  const sendLimitRemainingSeconds = remaining(state.sendLimitUntil, now);
  const otpRemainingSeconds = remaining(state.otpExpiresAt, now);
  const otpExpired = state.otpExpiresAt !== null && otpRemainingSeconds === 0;
  const locked = lockRemainingSeconds > 0;
  // A limit reported without a wait time keeps the button disabled until the
  // page is reloaded or the server answers differently; no countdown is invented.
  const hourlyBlocked = sendLimitRemainingSeconds > 0 || (state.sendLimitReached && state.sendLimitUntil === null);

  let resendBlockedBy: OtpControls['resendBlockedBy'] = null;
  if (locked) resendBlockedBy = 'locked';
  else if (hourlyBlocked) resendBlockedBy = 'hourly-limit';
  else if (resendRemainingSeconds > 0) resendBlockedBy = 'cooldown';

  return {
    otpExpired,
    otpRemainingSeconds,
    lockRemainingSeconds,
    resendRemainingSeconds,
    sendLimitRemainingSeconds,
    canVerify: !locked && state.otpExpiresAt !== null && !otpExpired,
    canResend: resendBlockedBy === null,
    resendBlockedBy,
  };
}

/** "m:ss" for countdowns; hours roll into minutes ("62:05"). */
export function formatCountdown(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${rest < 10 ? '0' : ''}${rest}`;
}

/** Whether anything in the state is still worth remembering at `now`. */
export function hasActiveRestriction(state: OtpState, now: number): boolean {
  const c = deriveOtpControls(state, now);
  return (
    c.lockRemainingSeconds > 0 ||
    c.resendRemainingSeconds > 0 ||
    c.sendLimitRemainingSeconds > 0 ||
    state.sendLimitReached ||
    (state.otpExpiresAt !== null && c.otpRemainingSeconds > 0)
  );
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Restore the state saved by a previous page load, or null when nothing is
 * still in force. Any storage error (private mode, blocked site data) reads
 * as "nothing saved"; the server still enforces every limit.
 */
export function loadOtpState(storage: StorageLike | null | undefined, now: number): OtpState | null {
  try {
    const raw = storage?.getItem(OTP_STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OtpState>;
    if (typeof parsed.phone !== 'string' || !/^\d{10}$/.test(parsed.phone)) return null;
    const numberOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const state: OtpState = {
      ...emptyOtpState(parsed.phone),
      otpExpiresAt: numberOrNull(parsed.otpExpiresAt),
      resendAvailableAt: numberOrNull(parsed.resendAvailableAt),
      lockedUntil: numberOrNull(parsed.lockedUntil),
      sendLimitUntil: numberOrNull(parsed.sendLimitUntil),
      sendLimitReached: parsed.sendLimitReached === true,
      attemptsRemaining: numberOrNull(parsed.attemptsRemaining),
      maxAttempts: numberOrNull(parsed.maxAttempts),
    };
    return hasActiveRestriction(state, now) ? state : null;
  } catch {
    return null;
  }
}

export function saveOtpState(storage: StorageLike | null | undefined, state: OtpState): void {
  try {
    storage?.setItem(OTP_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Per-viewer convenience only; the server is authoritative.
  }
}

export function clearOtpState(storage: StorageLike | null | undefined): void {
  try {
    storage?.removeItem(OTP_STATE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** The `{ code, message, details }` object inside an API error response, if any. */
export function apiErrorOf(error: unknown): { code?: string; message?: string; details?: unknown } | null {
  const body = (error as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
  return body && typeof body === 'object' ? (body as { code?: string; message?: string; details?: unknown }) : null;
}
