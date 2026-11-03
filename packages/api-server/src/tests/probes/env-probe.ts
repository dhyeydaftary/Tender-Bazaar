/**
 * Loads the real environment module in a fresh process and reports what it
 * decided. Used by production-config.test.ts to exercise actual startup
 * behaviour: an invalid configuration makes the import throw, which exits the
 * process non-zero with the configuration error on stderr.
 */
import { env, DEVELOPMENT_SHORTCUTS_ENABLED } from '../../config/env';

console.log(
  JSON.stringify({
    nodeEnv: env.NODE_ENV,
    developmentShortcuts: DEVELOPMENT_SHORTCUTS_ENABLED,
    allowDemoGoogleAuth: env.ALLOW_DEMO_GOOGLE_AUTH,
  }),
);
