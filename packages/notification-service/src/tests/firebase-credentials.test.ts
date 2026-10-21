import assert from 'node:assert/strict';

import {
  describePushCredential,
  resolveFirebaseCredential,
} from '../providers/firebase-credentials';

/**
 * Push-notification credential resolution.
 *
 * Phase 9 found that `providers/push.ts` initialized Firebase Admin with only
 * a project id and NO credential. Firebase Admin then falls back to
 * Application Default Credentials — absent in this container — so
 * initialization appeared to succeed and every send failed, swallowed. Push was
 * silently dead while `FIREBASE_PROJECT_ID` looked correctly set.
 *
 * These tests pin the two properties that matter: a real credential is
 * required, and an absent or broken one is reported HONESTLY rather than as a
 * working channel.
 *
 * No real credential is used. The private key below is a syntactically
 * plausible placeholder, not a key: it authenticates nothing.
 */

const FAKE_KEY = '-----BEGIN PRIVATE KEY-----\nnot-a-real-key\n-----END PRIVATE KEY-----\n';

function serviceAccountJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: 'service_account',
    project_id: 'tenderbazaar-test',
    client_email: 'push@tenderbazaar-test.iam.gserviceaccount.com',
    private_key: FAKE_KEY,
    ...overrides,
  });
}

console.log('--- Starting Firebase Push Credential Tests ---');

// 1. No path configured: push is DISABLED, and the reason says why a project
//    id alone is not enough.
{
  const { status, serviceAccount } = resolveFirebaseCredential({
    serviceAccountPath: '',
    projectId: 'tenderbazaar-test',
  });

  assert.equal(status.state, 'disabled');
  assert.equal(serviceAccount, undefined, 'no credential may be fabricated');
  assert.match(
    status.state === 'disabled' ? status.reason : '',
    /FIREBASE_SERVICE_ACCOUNT_PATH is not set/,
    'the reason must name the variable to set',
  );
  assert.match(
    status.state === 'disabled' ? status.reason : '',
    /Application Default Credentials/,
    'and must explain why FIREBASE_PROJECT_ID alone is insufficient',
  );

  console.log('✓ Absent credential reports DISABLED and names the missing variable');
}

// 2. Valid credential: configured, and the parsed fields are returned.
{
  const { status, serviceAccount } = resolveFirebaseCredential({
    serviceAccountPath: '/run/secrets/firebase.json',
    projectId: 'tenderbazaar-test',
    readFile: () => serviceAccountJson(),
  });

  assert.equal(status.state, 'configured');
  assert.ok(serviceAccount, 'a usable credential must be returned');
  assert.equal(serviceAccount!.projectId, 'tenderbazaar-test');
  assert.equal(serviceAccount!.clientEmail, 'push@tenderbazaar-test.iam.gserviceaccount.com');
  assert.equal(serviceAccount!.privateKey, FAKE_KEY);

  console.log('✓ A valid service-account key resolves to a usable credential');
}

// 3. Unreadable file: an ERROR (a misconfiguration), not a disabled feature —
//    the distinction decides whether an operator should act.
{
  const { status, serviceAccount } = resolveFirebaseCredential({
    serviceAccountPath: '/run/secrets/missing.json',
    readFile: () => {
      throw new Error("ENOENT: no such file or directory, open '/run/secrets/missing.json'");
    },
  });

  assert.equal(status.state, 'error', 'an unreadable path is a misconfiguration');
  assert.equal(serviceAccount, undefined);
  assert.match(status.state === 'error' ? status.reason : '', /could not be read/);
  assert.match(status.state === 'error' ? status.reason : '', /secret mount/);

  console.log('✓ An unreadable credential path reports ERROR, distinct from DISABLED');
}

// 4. Malformed JSON: error, and the file contents are NEVER echoed — the file
//    holds a private key, so an error message must not quote it.
{
  const secretish = `{"private_key":"${FAKE_KEY}" TRUNCATED`;
  const { status } = resolveFirebaseCredential({
    serviceAccountPath: '/run/secrets/firebase.json',
    readFile: () => secretish,
  });

  assert.equal(status.state, 'error');
  const reason = status.state === 'error' ? status.reason : '';
  assert.match(reason, /not valid JSON/);
  assert.ok(
    !reason.includes('BEGIN PRIVATE KEY'),
    'an error message must never echo the credential file contents',
  );
  assert.ok(!reason.includes(FAKE_KEY));

  console.log('✓ Malformed credential reports ERROR without echoing file contents');
}

// 5. Incomplete key: each missing required field is named.
{
  for (const missing of ['project_id', 'client_email', 'private_key']) {
    const body = JSON.parse(serviceAccountJson()) as Record<string, unknown>;
    delete body[missing];

    const { status } = resolveFirebaseCredential({
      serviceAccountPath: '/run/secrets/firebase.json',
      readFile: () => JSON.stringify(body),
    });

    assert.equal(status.state, 'error', `missing ${missing} must be an error`);
    assert.match(
      status.state === 'error' ? status.reason : '',
      new RegExp(missing),
      `the reason must name the missing field (${missing})`,
    );
  }

  // An empty-string field is as unusable as an absent one.
  const { status: blank } = resolveFirebaseCredential({
    serviceAccountPath: '/run/secrets/firebase.json',
    readFile: () => serviceAccountJson({ private_key: '   ' }),
  });
  assert.equal(blank.state, 'error', 'a blank required field must not pass');

  console.log('✓ Incomplete service-account keys are rejected, naming the missing field');
}

// 6. Project mismatch: refuse rather than authenticate against the wrong
//    project, which would otherwise be a silent misdelivery.
{
  const { status, serviceAccount } = resolveFirebaseCredential({
    serviceAccountPath: '/run/secrets/firebase.json',
    projectId: 'tenderbazaar-production',
    readFile: () => serviceAccountJson({ project_id: 'someone-elses-project' }),
  });

  assert.equal(status.state, 'error');
  assert.equal(serviceAccount, undefined, 'a mismatched credential must not be used');
  const reason = status.state === 'error' ? status.reason : '';
  assert.match(reason, /mismatch/i);
  assert.match(reason, /tenderbazaar-production/);
  assert.match(reason, /someone-elses-project/);

  console.log('✓ A key belonging to a different project is refused, not used');
}

// 7. An unset FIREBASE_PROJECT_ID does not block a valid key — the key itself
//    carries the project.
{
  const { status } = resolveFirebaseCredential({
    serviceAccountPath: '/run/secrets/firebase.json',
    projectId: '',
    readFile: () => serviceAccountJson(),
  });

  assert.equal(status.state, 'configured');

  console.log('✓ The key supplies the project when FIREBASE_PROJECT_ID is unset');
}

// 8. The human-readable summary is honest and value-free for every state.
{
  const configured = describePushCredential({
    state: 'configured',
    projectId: 'tenderbazaar-test',
    clientEmail: 'push@tenderbazaar-test.iam.gserviceaccount.com',
  });
  assert.match(configured, /push credential OK/);
  assert.match(configured, /tenderbazaar-test/);

  const disabled = describePushCredential({ state: 'disabled', reason: 'no path set' });
  assert.match(disabled, /push DISABLED/, 'must not imply push works');

  const errored = describePushCredential({ state: 'error', reason: 'bad file' });
  assert.match(errored, /push MISCONFIGURED/, 'must not imply push works');

  for (const line of [configured, disabled, errored]) {
    assert.ok(!line.includes('BEGIN PRIVATE KEY'), 'summaries must never carry key material');
    assert.ok(!line.includes(FAKE_KEY));
  }

  console.log('✓ Status summaries are honest per state and never carry key material');
}

console.log('--- All Firebase Push Credential Tests Passed ---');
