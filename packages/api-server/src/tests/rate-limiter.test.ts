import assert from 'node:assert/strict';
import { isRateLimitBypassed } from '../shared/middleware/rate-limiter';
import { envSchema } from '../config/env';

console.log('--- Starting Rate Limiter & Environment Configuration Tests ---');

/** Parse a candidate environment, returning the DISABLE_RATE_LIMIT result. */
function parseFlag(value?: string) {
  return envSchema.safeParse(
    value === undefined ? {} : { DISABLE_RATE_LIMIT: value },
  );
}

// 1. The development-only bypass requires BOTH conditions
{
  assert.equal(
    isRateLimitBypassed('development', 'true'),
    true,
    'Development + explicit opt-in must bypass',
  );

  assert.equal(
    isRateLimitBypassed('development', 'false'),
    false,
    'Development without opt-in must NOT bypass',
  );

  console.log('✓ Bypass active only when development AND DISABLE_RATE_LIMIT=true');
}

// 2. Production must never bypass, however the flag is set.
//    This is the security-critical case: a DISABLE_RATE_LIMIT=true that leaks
//    into a production env file must be inert.
{
  assert.equal(
    isRateLimitBypassed('production', 'true'),
    false,
    'Production with DISABLE_RATE_LIMIT=true must STILL rate limit',
  );

  assert.equal(
    isRateLimitBypassed('production', 'false'),
    false,
    'Production without the flag must rate limit',
  );

  assert.equal(
    isRateLimitBypassed('test', 'true'),
    false,
    'Test environment with the flag must still rate limit',
  );

  // Nothing other than the exact string 'development' may unlock the bypass.
  for (const nodeEnv of ['Development', 'DEVELOPMENT', 'dev', 'staging', '']) {
    assert.equal(
      isRateLimitBypassed(nodeEnv, 'true'),
      false,
      `NODE_ENV='${nodeEnv}' must not unlock the bypass`,
    );
  }

  console.log('✓ Production and non-development environments never bypass, even with the flag set');
}

// 3. Only the literal string 'true' opts in
{
  for (const flag of ['false', 'TRUE', 'True', '1', 'yes', 'on', '']) {
    assert.equal(
      isRateLimitBypassed('development', flag),
      false,
      `DISABLE_RATE_LIMIT='${flag}' must not opt in`,
    );
  }

  console.log('✓ Only the exact string "true" opts in; truthy look-alikes do not');
}

// 4. The flag is validated strictly, with a safe default when unset
{
  const unset = parseFlag();
  assert.ok(unset.success, 'An absent DISABLE_RATE_LIMIT must be valid');
  assert.equal(
    unset.success && unset.data.DISABLE_RATE_LIMIT,
    'false',
    'Unset DISABLE_RATE_LIMIT must default to the safe value "false"',
  );

  assert.ok(parseFlag('true').success, "'true' must be accepted");
  assert.ok(parseFlag('false').success, "'false' must be accepted");

  // Malformed values fail at startup rather than being coerced. A silently
  // truthy misparse here would disable rate limiting outright.
  for (const bad of ['yes', 'no', '1', '0', 'TRUE', 'True', '', 'maybe']) {
    assert.ok(
      !parseFlag(bad).success,
      `DISABLE_RATE_LIMIT='${bad}' must fail validation`,
    );
  }

  console.log('✓ DISABLE_RATE_LIMIT validated as a strict boolean string, defaulting to "false"');
}

// 5. Dev's generous limits and strict numeric validation are preserved
{
  const defaults = envSchema.safeParse({});
  assert.ok(defaults.success, 'Default environment must parse');
  assert.equal(defaults.success && defaults.data.RATE_LIMIT_AUTHED_MAX, 1000);
  assert.equal(defaults.success && defaults.data.RATE_LIMIT_ANON_MAX, 300);
  assert.equal(defaults.success && defaults.data.RATE_LIMIT_AUTH_MAX, 20);

  const custom = envSchema.safeParse({ RATE_LIMIT_AUTHED_MAX: '2500' });
  assert.equal(custom.success && custom.data.RATE_LIMIT_AUTHED_MAX, 2500);

  // Malformed ceilings must fail rather than become NaN (which
  // express-rate-limit reads as "no limit") or 0 (which blocks everything).
  for (const bad of ['abc', '', '0', '-5', '1.5', '1e3', ' 10 ']) {
    assert.ok(
      !envSchema.safeParse({ RATE_LIMIT_AUTHED_MAX: bad }).success,
      `RATE_LIMIT_AUTHED_MAX='${bad}' must fail validation`,
    );
  }

  console.log('✓ Authenticated/anonymous/auth ceilings keep their defaults and strict validation');
}

console.log('--- All Rate Limiter & Environment Tests Passed Successfully! ---');
