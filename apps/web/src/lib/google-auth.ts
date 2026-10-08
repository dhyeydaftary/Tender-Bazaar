/**
 * ============================================================================
 * [DEVELOPMENT / DEMO ONLY] Local Mock Google ID Token Generator
 * ============================================================================
 *
 * IMPORTANT: This helper creates a mock client-side pseudo-JWT token for local
 * development and testing without active Google Cloud OAuth credentials.
 *
 * PRODUCTION WARNING:
 * In production, client authentication MUST use the official Google Identity
 * Services SDK (@react-oauth/google or accounts.google.com/gsi/client) with
 * verified client credentials. The backend verifies authentic Google ID tokens
 * cryptographically using google-auth-library (OAuth2Client.verifyIdToken).
 *
 * Do NOT use this mock in production.
 * ============================================================================
 */
export function createGoogleIdToken(payload: {
  email: string;
  name?: string;
  picture?: string;
  sub?: string;
}): string {
  const header = { alg: 'RS256', typ: 'JWT', kid: 'tb-google-key' };

  const derivedName =
    payload.name ||
    payload.email
      .split('@')[0]
      .replace(/[._-]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const tokenPayload = {
    iss: 'https://accounts.google.com',
    azp: 'tenderbazaar-google-auth',
    aud: 'tenderbazaar-google-auth',
    sub: payload.sub || `google_${encodeURIComponent(payload.email).replace(/[^a-zA-Z0-9]/g, '')}`,
    email: payload.email.trim().toLowerCase(),
    email_verified: true,
    name: derivedName,
    picture:
      payload.picture ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(derivedName)}&background=4285F4&color=fff`,
    given_name: derivedName.split(' ')[0] || 'User',
    family_name: derivedName.split(' ').slice(1).join(' ') || '',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400,
  };

  const toBase64Url = (obj: any) => {
    const jsonStr = JSON.stringify(obj);
    if (typeof window !== 'undefined') {
      return btoa(unescape(encodeURIComponent(jsonStr)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    }
    return Buffer.from(jsonStr).toString('base64url');
  };

  const headerB64 = toBase64Url(header);
  const payloadB64 = toBase64Url(tokenPayload);
  const signatureB64 = 'google_id_token_sig_' + Math.random().toString(36).substring(2);

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}
