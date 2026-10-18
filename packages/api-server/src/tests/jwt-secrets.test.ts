import assert from 'node:assert/strict';
import {
  envSchema,
  validateJwtSecrets,
  checkProductionSecret,
  DEV_JWT_SECRET,
  DEV_JWT_REFRESH_SECRET,
  MIN_PRODUCTION_SECRET_LENGTH,
  validateProductionConnections,
} from '../config/env';

console.log('--- Starting JWT Secret Validation Tests ---');

/** A valid, independent pair of production-grade secrets. */
const STRONG_A = 'k7Qf2pLx9VzT4mNc8RbJ1hYw6sDgU3aE';
const STRONG_B = 'Z5tR8yHn2kQw7vXp4LmB9cJ3dFgS6aTe';

assert.equal(STRONG_A.length >= MIN_PRODUCTION_SECRET_LENGTH, true);
assert.equal(STRONG_B.length >= MIN_PRODUCTION_SECRET_LENGTH, true);

/**
 * Parse a candidate production environment.
 *
 * Valid infrastructure credentials are supplied by default so each case
 * exercises only the rule it is about; section 8 overrides them deliberately.
 */
const PROD_BASELINE = {
  NODE_ENV: 'production',
  REDIS_URL: 'redis://:A-real-Password-123@redis:6379',
  DATABASE_URL: 'postgresql://postgres:Another-real-Pass-9@postgres:5432/tenderbazaar',
};

function parseProd(overrides: Record<string, string>) {
  return envSchema.safeParse({
    ...PROD_BASELINE,
    ...overrides,
  });
}

// 1. Development keeps working with no secrets configured at all.
{
  const parsed = envSchema.safeParse({});
  assert.ok(parsed.success, 'An empty development environment must stay valid');
  assert.equal(parsed.data.JWT_SECRET, DEV_JWT_SECRET);
  assert.equal(parsed.data.JWT_REFRESH_SECRET, DEV_JWT_REFRESH_SECRET);

  const asTest = envSchema.safeParse({ NODE_ENV: 'test' });
  assert.ok(asTest.success, 'NODE_ENV=test must not require production secrets');

  console.log('✓ Development and test environments keep the built-in defaults');
}

// 2. Production rejects the development defaults.
//    This is the security-critical case: the previous schema applied these
//    defaults silently, so a forgotten JWT_SECRET produced an API whose tokens
//    anyone could forge from this repository's source.
{
  const leaked = parseProd({});
  assert.equal(
    leaked.success,
    false,
    'Production with no secrets configured must FAIL to start',
  );

  const explicit = parseProd({
    JWT_SECRET: DEV_JWT_SECRET,
    JWT_REFRESH_SECRET: DEV_JWT_REFRESH_SECRET,
  });
  assert.equal(
    explicit.success,
    false,
    'Production must reject the development default secrets',
  );

  console.log('✓ Production refuses to start on the development default secrets');
}

// 3. Production rejects missing / empty / short / placeholder / repeated values.
{
  const cases: Array<[string, Record<string, string>]> = [
    ['empty JWT_SECRET', { JWT_SECRET: '', JWT_REFRESH_SECRET: STRONG_B }],
    ['empty JWT_REFRESH_SECRET', { JWT_SECRET: STRONG_A, JWT_REFRESH_SECRET: '' }],
    ['whitespace-only', { JWT_SECRET: '    ', JWT_REFRESH_SECRET: STRONG_B }],
    ['too short', { JWT_SECRET: 'short-secret', JWT_REFRESH_SECRET: STRONG_B }],
    [
      'exactly one char below the minimum',
      {
        // 31 mixed characters: long enough to dodge every other rule, one
        // character short of the length floor.
        JWT_SECRET: 'abcdefghij'.repeat(4).slice(0, MIN_PRODUCTION_SECRET_LENGTH - 1),
        JWT_REFRESH_SECRET: STRONG_B,
      },
    ],
    [
      'known placeholder',
      { JWT_SECRET: 'changeme', JWT_REFRESH_SECRET: STRONG_B },
    ],
    [
      'long but still says change-in-production',
      {
        JWT_SECRET: 'my-super-long-secret-change-in-production-value',
        JWT_REFRESH_SECRET: STRONG_B,
      },
    ],
    [
      'single repeated character',
      { JWT_SECRET: 'x'.repeat(40), JWT_REFRESH_SECRET: STRONG_B },
    ],
  ];

  for (const [label, overrides] of cases) {
    const parsed = parseProd(overrides);
    assert.equal(
      parsed.success,
      false,
      `Production must reject ${label}`,
    );
  }

  console.log(`✓ Production rejects ${cases.length} classes of weak or missing secret`);
}

// 4. Production rejects reusing one value for both secrets.
{
  const shared = parseProd({ JWT_SECRET: STRONG_A, JWT_REFRESH_SECRET: STRONG_A });
  assert.equal(
    shared.success,
    false,
    'Production must reject identical access and refresh secrets',
  );

  console.log('✓ Production requires the two secrets to be independent');
}

// 5. A correctly configured production environment parses.
{
  const parsed = parseProd({ JWT_SECRET: STRONG_A, JWT_REFRESH_SECRET: STRONG_B });
  assert.ok(
    parsed.success,
    `Strong independent secrets must be accepted (got: ${
      parsed.success ? '' : JSON.stringify(parsed.error.issues)
    })`,
  );
  assert.equal(parsed.data.NODE_ENV, 'production');

  console.log('✓ Production accepts strong, independent secrets');
}

// 6. Failure messages name the variable but never leak its value.
{
  const parsed = parseProd({
    JWT_SECRET: 'changeme',
    JWT_REFRESH_SECRET: 'changeme',
  });
  assert.equal(parsed.success, false);
  if (!parsed.success) {
    const rendered = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    assert.match(rendered, /JWT_SECRET/, 'The report must name the variable');
    assert.equal(
      rendered.includes('changeme'),
      false,
      'The report must NOT echo the secret value',
    );
  }

  console.log('✓ Validation errors name the variable without echoing its value');
}

// 7. The pure helpers behave independently of process.env.
{
  assert.deepEqual(
    validateJwtSecrets({ NODE_ENV: 'development' }),
    [],
    'Development is never validated',
  );
  assert.equal(
    validateJwtSecrets({
      NODE_ENV: 'production',
      JWT_SECRET: STRONG_A,
      JWT_REFRESH_SECRET: STRONG_B,
    }).length,
    0,
    'A valid production pair yields no problems',
  );
  assert.equal(
    validateJwtSecrets({ NODE_ENV: 'production' }).length > 0,
    true,
    'Undefined production secrets yield problems',
  );
  assert.equal(checkProductionSecret('X', STRONG_A), null);
  assert.equal(typeof checkProductionSecret('X', undefined), 'string');

  console.log('✓ validateJwtSecrets / checkProductionSecret are pure and testable');
}

// 8. Production rejects development infrastructure credentials (Phase 2.4).
{
  const strong = { JWT_SECRET: STRONG_A, JWT_REFRESH_SECRET: STRONG_B };

  const weakRedis = [
    ['placeholder redis password', 'redis://:changeme@redis:6379'],
    ['no credentials at all', 'redis://redis:6379'],
    ['password "redis"', 'redis://:redis@redis:6379'],
  ] as const;

  for (const [label, REDIS_URL] of weakRedis) {
    const parsed = parseProd({
      ...strong,
      REDIS_URL,
      DATABASE_URL: 'postgresql://postgres:A-real-Password-123@postgres:5432/tenderbazaar',
    });
    assert.equal(parsed.success, false, `Production must reject REDIS_URL with ${label}`);
  }

  const weakDb = parseProd({
    ...strong,
    REDIS_URL: 'redis://:A-real-Password-123@redis:6379',
    DATABASE_URL: 'postgresql://postgres:postgres@postgres:5432/tenderbazaar',
  });
  assert.equal(
    weakDb.success,
    false,
    'Production must reject the development default database password',
  );

  const good = parseProd({
    ...strong,
    REDIS_URL: 'redis://:A-real-Password-123@redis:6379',
    DATABASE_URL: 'postgresql://postgres:Another-real-Pass-9@postgres:5432/tenderbazaar',
  });
  assert.ok(
    good.success,
    `Real credentials must be accepted (got: ${
      good.success ? '' : JSON.stringify(good.error.issues)
    })`,
  );

  // Percent-encoded weak passwords must not slip through.
  const encoded = parseProd({
    ...strong,
    REDIS_URL: 'redis://:change%2Dme@redis:6379',
    DATABASE_URL: 'postgresql://postgres:Another-real-Pass-9@postgres:5432/tenderbazaar',
  });
  assert.equal(
    encoded.success,
    false,
    'A percent-encoded placeholder password must still be rejected',
  );

  // Development is unaffected.
  assert.deepEqual(
    validateProductionConnections({
      NODE_ENV: 'development',
      REDIS_URL: 'redis://redis:6379',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/tenderbazaar',
    }),
    [],
    'Development keeps using local credentials',
  );

  console.log('✓ Production rejects placeholder/absent Redis and default database passwords');
}

console.log('--- All JWT Secret Validation Tests Passed ---');
