import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { AxiosAdapter, AxiosInstance } from 'axios';
import { resolveApiBaseUrl, LOCAL_DEVELOPMENT_API_URL, API_URL_NOT_CONFIGURED_MESSAGE } from '../api-url';

/**
 * The browser must never be sent to the visitor's own localhost in production.
 *
 * lib/api.ts used to fall back to http://localhost:4000/api/v1 whenever
 * NEXT_PUBLIC_API_URL was missing at build time, so a Vercel build without the
 * variable succeeded and then called every visitor's own machine. Now:
 *   - a production `next build` fails without a valid URL (api-url.config.js);
 *   - a production bundle that still lacks the URL sends nothing at all;
 *   - development keeps its localhost default.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { validateApiUrlForBuild } = require('../../../api-url.config') as {
  validateApiUrlForBuild: (env: Record<string, string | undefined>) => { url: string | null; problem: string | null };
};

console.log('--- Starting API URL Configuration Tests ---');

async function main(): Promise<void> {
  // 1. Runtime resolution of the inlined value.
  {
    assert.equal(resolveApiBaseUrl('https://api.example.com/api/v1/', 'production'), 'https://api.example.com/api/v1');
    assert.equal(resolveApiBaseUrl('/api/v1', 'production'), '/api/v1');
    for (const missing of [undefined, '', '   ']) {
      assert.equal(
        resolveApiBaseUrl(missing, 'production'),
        null,
        `production without a URL resolves to null, never localhost (${JSON.stringify(missing)})`,
      );
      assert.equal(resolveApiBaseUrl(missing, 'development'), LOCAL_DEVELOPMENT_API_URL, 'development keeps the localhost default');
      assert.equal(resolveApiBaseUrl(missing, 'test'), LOCAL_DEVELOPMENT_API_URL);
    }
    assert.match(API_URL_NOT_CONFIGURED_MESSAGE, /NEXT_PUBLIC_API_URL/, 'the error names the variable to set');
    console.log('✓ Production resolves a missing URL to null; development keeps localhost');
  }

  // 2. Build-time validation (next.config.js runs this for `next build`).
  {
    const ok = (env: Record<string, string>, expected: string) => {
      const result = validateApiUrlForBuild(env);
      assert.equal(result.problem, null, `${JSON.stringify(env)} should pass: ${result.problem}`);
      assert.equal(result.url, expected);
    };
    const bad = (env: Record<string, string>, pattern: RegExp) => {
      const result = validateApiUrlForBuild(env);
      assert.ok(result.problem, `${JSON.stringify(env)} should be refused`);
      assert.match(result.problem, /NEXT_PUBLIC_API_URL/, 'the message names the variable');
      assert.match(result.problem, pattern);
      assert.equal(result.url, null);
    };

    bad({}, /not set/);
    bad({ NEXT_PUBLIC_API_URL: '   ' }, /not set/);
    bad({ NEXT_PUBLIC_API_URL: 'not a url' }, /absolute URL/);
    bad({ NEXT_PUBLIC_API_URL: '//evil.example/api/v1' }, /absolute URL/);
    bad({ NEXT_PUBLIC_API_URL: 'ftp://api.example.com' }, /http or https/);
    bad({ NEXT_PUBLIC_API_URL: 'https://user:pass@api.example.com/api/v1' }, /credentials/);
    bad({ NEXT_PUBLIC_API_URL: 'https://api.example.com/api/v1?debug=1' }, /query/);
    bad({ NEXT_PUBLIC_API_URL: '/api/v1#x' }, /query string or a fragment/);

    // Vercel: https only, and never a loopback host.
    bad({ VERCEL: '1', NEXT_PUBLIC_API_URL: 'http://api.example.com/api/v1' }, /https on Vercel/);
    for (const host of ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', 'api.localhost']) {
      bad({ VERCEL: '1', NEXT_PUBLIC_API_URL: `https://${host}:4000/api/v1` }, /localhost on Vercel/);
    }
    ok({ VERCEL: '1', NEXT_PUBLIC_API_URL: 'https://tenderbazaar-api.onrender.com/api/v1/' }, 'https://tenderbazaar-api.onrender.com/api/v1');
    ok({ VERCEL: '1', NEXT_PUBLIC_API_URL: '/api/v1' }, '/api/v1');

    // Local and Docker production builds may still target a local API.
    ok({ NEXT_PUBLIC_API_URL: 'http://localhost:4000/api/v1' }, 'http://localhost:4000/api/v1');
    ok({ NEXT_PUBLIC_API_URL: 'http://api:4000/api/v1' }, 'http://api:4000/api/v1');
    console.log('✓ Production builds refuse a missing or unsafe NEXT_PUBLIC_API_URL; Vercel builds need a public https API');
  }

  // 3. The real axios client, loaded as a production bundle would be.
  {
    const load = (apiUrl: string | undefined): AxiosInstance => {
      // Next's typings mark NODE_ENV read-only; this test deliberately plays
      // the role of a production build.
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      if (apiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
      else process.env.NEXT_PUBLIC_API_URL = apiUrl;
      for (const mod of ['../api-url', '../api']) delete require.cache[require.resolve(mod)];
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('../api').default;
    };

    const sent: string[] = [];
    const recordingAdapter: AxiosAdapter = async (config) => {
      sent.push(`${config.baseURL ?? ''}${config.url ?? ''}`);
      return { data: { success: true, data: {} }, status: 200, statusText: 'OK', headers: {}, config };
    };

    // Without the URL: every request is refused locally, nothing is sent.
    const broken = load(undefined);
    broken.defaults.adapter = recordingAdapter;
    await assert.rejects(broken.get('/auth/me'), (err: Error) => err.message === API_URL_NOT_CONFIGURED_MESSAGE);
    await assert.rejects(broken.post('/auth/login', { email: 'a@example.com', password: 'x' }));
    assert.deepEqual(sent, [], 'nothing may be sent when the build had no API URL');

    // With the URL: every request goes there.
    const configured = load('https://tenderbazaar-api.onrender.com/api/v1/');
    configured.defaults.adapter = recordingAdapter;
    await configured.get('/plans');
    await configured.post('/auth/login', { email: 'a@example.com', password: 'x' });
    assert.deepEqual(
      sent,
      ['https://tenderbazaar-api.onrender.com/api/v1/plans', 'https://tenderbazaar-api.onrender.com/api/v1/auth/login'],
      'every request uses the configured base URL',
    );
    console.log('✓ Real client: no URL means no requests; a configured URL is used for every request');
  }

  // 4. No other localhost API fallback hides anywhere in the app source.
  {
    const srcRoot = join(__dirname, '..', '..');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
          walk(path);
          continue;
        }
        // Tests may mention the address in their fixtures; application code may not.
        if (!/\.(ts|tsx)$/.test(entry) || /\.test\.tsx?$/.test(entry) || path.endsWith(join('lib', 'api-url.ts'))) continue;
        if (/localhost:4000|127\.0\.0\.1:4000/.test(readFileSync(path, 'utf8'))) offenders.push(relative(srcRoot, path));
      }
    };
    walk(srcRoot);
    assert.deepEqual(offenders, [], 'only lib/api-url.ts may know the development API address');
    console.log('✓ lib/api-url.ts is the only place that knows the development API address');
  }

  console.log('--- All API URL Configuration Tests Passed ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
