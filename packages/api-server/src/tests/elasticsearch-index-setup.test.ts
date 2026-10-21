import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { createTenderIndexWith, type TenderIndicesClient } from '../config/elasticsearch-setup';

/**
 * Tender-index setup must report failure and retry it.
 *
 * Phase 12 observed Elasticsearch time out while creating the tender index. The
 * old code did two things wrong with that:
 *
 *   1. it swallowed the error (`catch { console.error(...) }`, no rethrow, no
 *      return value), so the caller could not tell success from failure - and
 *      `bootstrap()` printed "Elasticsearch index ready" unconditionally,
 *      producing a boot log that claimed readiness directly alongside
 *      "Failed to create or update tender index: TimeoutError";
 *   2. it never retried, so one transient timeout left the index missing until
 *      somebody restarted the container. Nothing else ever calls
 *      createTenderIndex().
 *
 * These checks drive the real retry logic through `createTenderIndexWith`,
 * which takes the client explicitly, so no cluster is contacted and no index is
 * created anywhere.
 */

console.log('--- Starting Elasticsearch Index Setup Tests ---');

interface Calls {
  exists: number;
  create: number;
  putMapping: number;
}

function timeoutError(): Error {
  const err = new Error('Request timed out');
  err.name = 'TimeoutError';
  return err;
}

// tsx transpiles this suite to CJS, where top-level await is unavailable.
async function main(): Promise<void> {
// 1. The happy path: index absent -> created, reported ok, one attempt.
{
  const calls: Calls = { exists: 0, create: 0, putMapping: 0 };
  const indices: TenderIndicesClient = ({
    exists: async () => {
      calls.exists++;
      return false;
    },
    create: async () => {
      calls.create++;
      return {};
    },
    putMapping: async () => {
      calls.putMapping++;
      return {};
    },
  } as TenderIndicesClient);

  const result = await createTenderIndexWith(indices);

  assert.equal(result.ok, true);
  assert.equal(result.detail, 'created');
  assert.equal(result.attempts, 1, 'a success must not retry');
  assert.equal(calls.create, 1, 'the index is created exactly once');
  assert.equal(calls.putMapping, 0, 'a freshly created index needs no putMapping');

  console.log('✓ A missing index is created and reported ok in one attempt');
}

// 2. Index already present -> mapping updated, still ok.
{
  const calls: Calls = { exists: 0, create: 0, putMapping: 0 };
  const indices: TenderIndicesClient = ({
    exists: async () => {
      calls.exists++;
      return true;
    },
    create: async () => {
      calls.create++;
      return {};
    },
    putMapping: async () => {
      calls.putMapping++;
      return {};
    },
  } as TenderIndicesClient);

  const result = await createTenderIndexWith(indices);

  assert.equal(result.ok, true);
  assert.equal(result.detail, 'mapping-updated');
  assert.equal(calls.create, 0, 'an existing index must never be re-created');
  assert.equal(calls.putMapping, 1);

  console.log('✓ An existing index has its mapping updated, never re-created');
}

// 3. THE REGRESSION: a timeout is RETRIED, and a later attempt can succeed.
//    The old code made exactly one attempt and swallowed the failure.
{
  const calls: Calls = { exists: 0, create: 0, putMapping: 0 };
  let failuresLeft = 2;
  const indices: TenderIndicesClient = ({
    exists: async () => {
      calls.exists++;
      if (failuresLeft-- > 0) throw timeoutError();
      return false;
    },
    create: async () => {
      calls.create++;
      return {};
    },
    putMapping: async () => {
      calls.putMapping++;
      return {};
    },
  } as TenderIndicesClient);

  const result = await createTenderIndexWith(indices);

  assert.equal(result.ok, true, 'a transient timeout must not be terminal');
  assert.equal(result.attempts, 3, 'it should take the third attempt here');
  assert.equal(calls.exists, 3, 'each attempt re-checks');
  assert.equal(calls.create, 1, 'and the index is still created exactly once');

  console.log('✓ A transient timeout is retried and can still succeed');
}

// 4. A persistent failure is REPORTED, not swallowed — and names the reason.
{
  const indices: TenderIndicesClient = ({
    exists: async () => {
      throw timeoutError();
    },
    create: async () => ({}),
    putMapping: async () => ({}),
  } as TenderIndicesClient);

  const result = await createTenderIndexWith(indices);

  assert.equal(result.ok, false, 'the caller MUST be able to see the failure');
  assert.equal(result.attempts, 3, 'all attempts are used before giving up');
  assert.match(
    result.detail,
    /TimeoutError/,
    'the reason must name the failure so a log can be acted on',
  );

  console.log('✓ A persistent failure is reported to the caller with its reason');
}

// 5. The failure reason must not leak the Elasticsearch request.
//    Client errors carry the whole request — including headers — in `meta`.
{
  const err = new Error('Request timed out') as Error & { meta?: unknown };
  err.name = 'TimeoutError';
  err.meta = {
    request: { headers: { authorization: 'Basic c2VjcmV0OnBhc3N3b3Jk' } },
  };

  const indices: TenderIndicesClient = ({
    exists: async () => {
      throw err;
    },
    create: async () => ({}),
    putMapping: async () => ({}),
  } as TenderIndicesClient);

  const result = await createTenderIndexWith(indices);

  assert.equal(result.ok, false);
  assert.ok(
    !result.detail.includes('authorization') && !result.detail.includes('c2VjcmV0'),
    'the reason must carry no request metadata or credential material',
  );
  assert.equal(result.detail, 'TimeoutError: Request timed out');

  console.log('✓ The reported reason carries no request metadata or credentials');
}

// 6. Attempts are configurable, so a caller can fail fast if it wants to.
{
  let attemptsMade = 0;
  const indices: TenderIndicesClient = ({
    exists: async () => {
      attemptsMade++;
      throw timeoutError();
    },
    create: async () => ({}),
    putMapping: async () => ({}),
  } as TenderIndicesClient);

  const result = await createTenderIndexWith(indices, 1);

  assert.equal(result.ok, false);
  assert.equal(result.attempts, 1);
  assert.equal(attemptsMade, 1, 'one attempt means exactly one call, and no backoff wait');

  console.log('✓ The attempt count is configurable (1 = fail fast, no backoff)');
}

// 7. Startup must not claim readiness when setup failed.
//    Asserted against index.ts's source, because importing it boots the whole
//    server. The old line was an unconditional console.log of
//    'Elasticsearch index ready'.
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.ts'), 'utf8');

  assert.ok(
    !/^\s*console\.log\('Elasticsearch index ready'\);\s*$/m.test(src),
    'the unconditional "index ready" log must be gone',
  );
  assert.match(src, /indexSetup\.ok/, 'readiness must be logged conditionally on the result');
  assert.match(
    src,
    /NOT ready/,
    'the failure branch must say the index is not ready',
  );

  console.log('✓ Startup logs index readiness conditionally, not unconditionally');
}

  console.log('--- All Elasticsearch Index Setup Tests Passed ---');
}

void main();
