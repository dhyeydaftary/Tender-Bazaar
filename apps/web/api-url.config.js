// Build-time check of NEXT_PUBLIC_API_URL, run by next.config.js for
// production builds.
//
// NEXT_PUBLIC_* values are inlined into the browser bundle when `next build`
// runs. The API client used to fall back to http://localhost:4000/api/v1 when
// the variable was missing, so a production build without it succeeded and
// then sent every request to the visitor's own machine. A production build now
// fails instead, with a message naming the variable.
//
// Rules for a production build:
//   - NEXT_PUBLIC_API_URL must be set, either to an absolute http(s) URL with
//     no query, fragment or credentials, or to a same-origin path such as
//     /api/v1 when a reverse proxy serves the API (docker-compose.demo-server.yml);
//   - on Vercel (VERCEL=1) it must also use https and must not point at a
//     loopback host. Local `next build` / Docker builds may still target a
//     local API, as docker-compose.yml does.
//
// Plain CommonJS so next.config.js can require it and the tests can import it.

const LOOPBACK_HOST = /^(localhost|.*\.localhost|127(\.\d+){3}|0\.0\.0\.0|\[::1\])$/;

/**
 * @param {{ NEXT_PUBLIC_API_URL?: string, VERCEL?: string }} env
 * @returns {{ url: string, problem: null } | { url: null, problem: string }}
 */
function validateApiUrlForBuild(env) {
  const value = (env.NEXT_PUBLIC_API_URL || '').trim();
  const fail = (problem) => ({ url: null, problem: `NEXT_PUBLIC_API_URL ${problem}` });

  if (value === '') {
    return fail(
      'is not set. Production builds need the public API base URL, e.g. https://api.example.com/api/v1. ' +
        'Without it the app would call the visitor\'s localhost.',
    );
  }

  // A same-origin path: the browser calls the site's own origin, never the
  // visitor's machine. `//host` would be protocol-relative, so it is excluded.
  if (value.startsWith('/') && !value.startsWith('//')) {
    if (/[?#]/.test(value)) return fail('must not contain a query string or a fragment.');
    return { url: value.replace(/\/+$/, ''), problem: null };
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    return fail('must be an absolute URL such as https://api.example.com/api/v1, or a same-origin path such as /api/v1.');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return fail('must use http or https.');
  }
  if (url.username || url.password || url.search || url.hash) {
    return fail('must not contain credentials, a query string or a fragment.');
  }

  if (env.VERCEL === '1') {
    if (url.protocol !== 'https:') {
      return fail('must use https on Vercel.');
    }
    if (LOOPBACK_HOST.test(url.hostname)) {
      return fail('must not point at localhost on Vercel.');
    }
  }

  return { url: value.replace(/\/+$/, ''), problem: null };
}

module.exports = { validateApiUrlForBuild };
