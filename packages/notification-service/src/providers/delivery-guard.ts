import { config } from '../config';

/**
 * Thrown when a notification channel has no provider configured on a
 * production server. The BullMQ job fails with this error, so the gap shows
 * up in the failed-jobs list and the logs instead of a "completed" job whose
 * message was only printed to the console.
 */
export class ProviderNotConfiguredError extends Error {
  readonly code: string;
  readonly channel: string;

  constructor(channel: string, variables: string) {
    super(
      `${channel} delivery is not configured on this server; set ${variables}. ` +
        'The message was NOT delivered.',
    );
    this.name = 'ProviderNotConfiguredError';
    this.code = `${channel.toUpperCase()}_NOT_CONFIGURED`;
    this.channel = channel;
  }
}

/**
 * Call when a channel is about to fall back to printing the message. In
 * development and test the fallback is allowed (and useful); in production
 * it is a delivery failure and this throws.
 */
export function assertDevFallbackAllowed(channel: string, variables: string): void {
  if (config.isProduction) {
    throw new ProviderNotConfiguredError(channel, variables);
  }
}
