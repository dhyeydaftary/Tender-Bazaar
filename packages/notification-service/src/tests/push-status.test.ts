import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Honest push-delivery status, at the provider and startup layers.
 *
 * firebase-credentials.test.ts covers credential resolution. This file covers
 * the two behaviours that made push silently dead in Phase 9:
 *
 *   1. `initializeApp` must pass a real credential, never just a project id;
 *   2. an absent or broken credential must be REPORTED, never presented as a
 *      working channel.
 *
 * The provider is asserted partly against its source, because importing it
 * pulls in `firebase-admin` and the BullMQ/Redis-backed config chain, which a
 * unit test should not require. That is weaker than calling the code — stated
 * here rather than implied — and is why the resolution logic itself lives in a
 * separately testable module that IS called directly.
 */

const SRC_DIR = join(__dirname, '..');
const PUSH_SRC = readFileSync(join(SRC_DIR, 'providers', 'push.ts'), 'utf8');
const INDEX_SRC = readFileSync(join(SRC_DIR, 'index.ts'), 'utf8');
const CONFIG_SRC = readFileSync(join(SRC_DIR, 'config.ts'), 'utf8');

console.log('--- Starting Push Delivery Status Tests ---');

// 1. initializeApp passes a real credential.
{
  assert.ok(
    /admin\.credential\.cert\(/.test(PUSH_SRC),
    'initializeApp must use admin.credential.cert() with a service account',
  );

  const initCall = PUSH_SRC.slice(
    PUSH_SRC.indexOf('admin.initializeApp('),
    PUSH_SRC.indexOf('messaging = admin.messaging'),
  );
  assert.ok(
    initCall.includes('credential:'),
    'the initializeApp call must supply a credential',
  );

  // The exact Phase 9 defect: initializeApp({ projectId }) with nothing else.
  assert.ok(
    !/initializeApp\(\{\s*projectId:\s*config\.firebase\.projectId,?\s*\}\)/.test(PUSH_SRC),
    'initializeApp must not be called with only a project id — that silently falls back ' +
      'to Application Default Credentials, which do not exist in the container',
  );

  console.log('✓ Firebase Admin is initialized with a real service-account credential');
}

// 2. The provider exposes status, and refuses to send without a credential.
{
  assert.ok(
    /export function getPushStatus\(\)/.test(PUSH_SRC),
    'the provider must expose a status for health reporting',
  );

  // getMessaging returns null unless the credential resolved as 'configured'.
  assert.ok(
    /resolved\.status\.state !== 'configured'/.test(PUSH_SRC),
    'messaging must only be built from a configured credential',
  );
  // And the send path already treats a null messaging as a failure.
  assert.ok(
    /if \(!msg\) \{[\s\S]{0,200}return false;/.test(PUSH_SRC),
    'a send with no messaging must return false, not a success',
  );

  console.log('✓ Without a credential the provider reports status and sends nothing');
}

// 3. An initialization failure is recorded as a misconfiguration, not silence.
{
  // Target the initialization failure specifically. push.ts has more than one
  // catch block (the send path has its own), so anchor on the init message
  // rather than on the last `catch` in the file.
  const initFailAt = PUSH_SRC.indexOf('Firebase Admin initialization failed');
  assert.ok(initFailAt > 0, 'the init failure path must set an explicit message');

  const initCatch = PUSH_SRC.slice(initFailAt - 400, initFailAt + 400);
  assert.ok(
    initCatch.includes("state: 'error'"),
    'an initialization failure must be recorded as an error state',
  );
  assert.ok(
    /describePushCredential/.test(initCatch),
    'and must be logged through the value-free summary helper',
  );

  console.log('✓ An initialization failure is recorded as MISCONFIGURED, not swallowed');
}

// 4. Startup: required vs optional, with other channels preserved.
{
  assert.ok(
    /config\.firebase\.required/.test(INDEX_SRC),
    'startup must consult PUSH_NOTIFICATIONS_REQUIRED',
  );
  assert.ok(
    /process\.exit\(1\)/.test(INDEX_SRC),
    'a required-but-unusable push credential must fail startup clearly',
  );
  assert.ok(
    /Continuing without push/.test(INDEX_SRC),
    'when push is optional the service must continue and say so',
  );
  assert.ok(
    /Other channels are unaffected/.test(INDEX_SRC),
    'and must state that other channels keep working',
  );

  // The required flag must default to OFF, so adding this check cannot take a
  // previously-working deployment down.
  assert.ok(
    /PUSH_NOTIFICATIONS_REQUIRED \|\| 'false'/.test(CONFIG_SRC),
    'PUSH_NOTIFICATIONS_REQUIRED must default to false',
  );

  console.log('✓ Startup fails clearly when push is required, degrades honestly when not');
}

// 5. No credential value is ever logged, and no key is committed.
{
  // The provider may log the project and the service-account email (identifiers,
  // not secrets) but never the key.
  assert.ok(
    !/privateKey\b[^\n]*console\./.test(PUSH_SRC),
    'the private key must never reach a console call',
  );
  for (const src of [PUSH_SRC, INDEX_SRC, CONFIG_SRC]) {
    assert.ok(
      !src.includes('BEGIN PRIVATE KEY'),
      'no source file may contain key material',
    );
  }

  // A path is configured, not an inline blob: a private key in an env var
  // leaks into `docker inspect` and any accidental environment dump.
  assert.ok(
    /FIREBASE_SERVICE_ACCOUNT_PATH/.test(CONFIG_SRC),
    'the credential must be supplied as a mounted file path',
  );
  assert.ok(
    !/FIREBASE_PRIVATE_KEY/.test(CONFIG_SRC),
    'the private key must not be read from an environment variable',
  );

  console.log('✓ Credentials come from a mounted path; no key material in source or logs');
}

console.log('--- All Push Delivery Status Tests Passed ---');
