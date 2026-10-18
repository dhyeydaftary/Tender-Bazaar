import { readFileSync } from 'node:fs';

/**
 * Firebase Admin credential resolution for push notifications.
 *
 * Phase 9 found that `providers/push.ts` called
 * `admin.initializeApp({ projectId })` with **no credential**. Firebase Admin
 * then falls back to Application Default Credentials — a metadata server or
 * `GOOGLE_APPLICATION_CREDENTIALS` — neither of which exists in this
 * container. Initialization appeared to succeed, every send failed, and the
 * failure was swallowed, so push notifications were silently dead while
 * `FIREBASE_PROJECT_ID` looked correctly configured.
 *
 * This module resolves and validates a real service-account credential, and —
 * just as importantly — reports honestly when there isn't one.
 *
 * A FILE PATH is used rather than inline JSON in an environment variable:
 *   * a private key in an env var leaks into `docker inspect`, crash dumps and
 *     any accidental environment log;
 *   * multi-line PEM in env vars invites `\\n`-escaping bugs;
 *   * a path works with Docker/Swarm secrets, Kubernetes secret volumes and a
 *     plain read-only bind mount, none of which bake the key into the image.
 *
 * No credential VALUE is ever logged or returned in an error message.
 */

export type PushCredentialStatus =
  /** No credential configured. Push is deliberately disabled. */
  | { state: 'disabled'; reason: string }
  /** A credential is configured and structurally valid. */
  | { state: 'configured'; projectId: string; clientEmail: string }
  /** A credential is configured but unusable — a misconfiguration to fix. */
  | { state: 'error'; reason: string };

export interface FirebaseServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

/** Fields a Firebase service-account JSON must carry to authenticate. */
const REQUIRED_FIELDS = ['project_id', 'client_email', 'private_key'] as const;

/**
 * Resolve the service-account credential.
 *
 * Returns a status rather than throwing, so a caller can decide whether an
 * absent credential is fatal (push required) or merely a disabled feature.
 * Error reasons name the problem and the variable, never the file's contents.
 */
export function resolveFirebaseCredential(input: {
  serviceAccountPath?: string;
  projectId?: string;
  /** Injected for tests; defaults to reading the filesystem. */
  readFile?: (path: string) => string;
}): { status: PushCredentialStatus; serviceAccount?: FirebaseServiceAccount } {
  const path = (input.serviceAccountPath ?? '').trim();
  const read = input.readFile ?? ((p: string) => readFileSync(p, 'utf8'));

  if (path === '') {
    return {
      status: {
        state: 'disabled',
        reason:
          'FIREBASE_SERVICE_ACCOUNT_PATH is not set, so no push credential is available. ' +
          'FIREBASE_PROJECT_ID alone is NOT sufficient — Firebase Admin would fall back to ' +
          'Application Default Credentials, which do not exist in this container.',
      },
    };
  }

  let raw: string;
  try {
    raw = read(path);
  } catch (err) {
    // Report the path (operator-supplied, not secret) but never the contents.
    return {
      status: {
        state: 'error',
        reason:
          `FIREBASE_SERVICE_ACCOUNT_PATH points at '${path}', which could not be read ` +
          `(${err instanceof Error ? err.message : 'unknown error'}). Check the secret ` +
          'mount and file permissions.',
      },
    };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // Deliberately does not echo `raw` — it holds the private key.
    return {
      status: {
        state: 'error',
        reason: `The file at '${path}' is not valid JSON. Expected a Firebase service-account key.`,
      },
    };
  }

  const missing = REQUIRED_FIELDS.filter(
    (field) => typeof parsed[field] !== 'string' || (parsed[field] as string).trim() === '',
  );
  if (missing.length > 0) {
    return {
      status: {
        state: 'error',
        reason:
          `The service-account file at '${path}' is missing required field(s): ` +
          `${missing.join(', ')}. It does not look like a Firebase service-account key.`,
      },
    };
  }

  const projectId = (parsed.project_id as string).trim();
  const clientEmail = (parsed.client_email as string).trim();
  const privateKey = parsed.private_key as string;

  // A mismatch means push would authenticate against a different project than
  // the rest of the configuration expects — silent misdelivery otherwise.
  const configuredProject = (input.projectId ?? '').trim();
  if (configuredProject !== '' && configuredProject !== projectId) {
    return {
      status: {
        state: 'error',
        reason:
          `Project mismatch: FIREBASE_PROJECT_ID is '${configuredProject}' but the ` +
          `service-account key belongs to '${projectId}'. Refusing to initialize against ` +
          'the wrong project.',
      },
    };
  }

  return {
    status: { state: 'configured', projectId, clientEmail },
    serviceAccount: { projectId, clientEmail, privateKey },
  };
}

/**
 * One-line, value-free summary for logs and health reporting.
 *
 * `clientEmail` is an service-account identifier, not a secret, and is the
 * single most useful thing for an operator diagnosing the wrong-key case.
 */
export function describePushCredential(status: PushCredentialStatus): string {
  switch (status.state) {
    case 'configured':
      return `push credential OK (project=${status.projectId}, account=${status.clientEmail})`;
    case 'disabled':
      return `push DISABLED — ${status.reason}`;
    case 'error':
      return `push MISCONFIGURED — ${status.reason}`;
  }
}
