import { OAuth2Client } from 'google-auth-library';
import { env, parseOriginList } from '../../config/env';
import { AppError } from '../../shared/middleware/error-handler';

/** The identity a verified Google ID token vouches for. */
export interface VerifiedGoogleIdentity {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

/** The OAuth client ids whose tokens are accepted; empty disables Google sign-in. */
export function googleClientIds(): string[] {
  return parseOriginList(env.GOOGLE_CLIENT_ID);
}

let sharedClient: OAuth2Client | null = null;

/**
 * Verify a Google ID token and return the identity it proves.
 *
 * google-auth-library's verifyIdToken checks the RS256 signature against
 * Google's published keys, the issuer (accounts.google.com), the audience
 * (one of our client ids) and the issue/expiry times. On top of that the
 * token must name a subject and an email Google has verified, because the
 * email is what links the sign-in to an existing account.
 *
 * Nothing from the token beyond those identity claims is used: in particular
 * it can never choose a role.
 *
 * `client` is injectable so tests can supply their own signing keys; it
 * defaults to a shared client that fetches Google's keys.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  options: { audience?: string[]; client?: OAuth2Client } = {},
): Promise<VerifiedGoogleIdentity> {
  const audience = options.audience ?? googleClientIds();
  if (audience.length === 0) {
    throw new AppError('Google sign-in is not available on this server', 503, 'GOOGLE_AUTH_DISABLED');
  }

  const client = options.client ?? (sharedClient ??= new OAuth2Client());

  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience });
    payload = ticket.getPayload();
  } catch {
    throw new AppError('Invalid Google token', 401, 'INVALID_GOOGLE_TOKEN');
  }

  if (!payload || typeof payload.sub !== 'string' || payload.sub === '') {
    throw new AppError('Invalid Google token', 401, 'INVALID_GOOGLE_TOKEN');
  }
  if (typeof payload.email !== 'string' || payload.email === '' || payload.email_verified !== true) {
    throw new AppError('Your Google account email is not verified', 401, 'GOOGLE_EMAIL_UNVERIFIED');
  }

  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name || 'Google User',
    picture: payload.picture,
  };
}
