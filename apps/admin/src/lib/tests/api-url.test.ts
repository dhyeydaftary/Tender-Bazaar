import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { resolveApiBaseUrl, LOCAL_DEVELOPMENT_API_URL, API_URL_NOT_CONFIGURED_MESSAGE } from '../api-url';

/**
 * The admin app must never be sent to the visitor's own localhost in
 * production. lib/api.ts and lib/auth.ts used to fall back to
 * http://localhost:4000/api/v1 when NEXT_PUBLIC_API_URL was missing at build
 * time. Now a production `next build` fails without a valid URL
 * (api-url.config.js), a bundle that still lacks it sends nothing, and
 * development keeps its localhost default. Mirrors apps/web.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { validateApiUrlForBuild } = require('../../../api-url.config') as {
  validateApiUrlForBuild: (env: Record<string, string | undefined>) => { url: string | null; problem: string | null };
};

console.log('--- Starting Admin API URL Configuration Tests ---');

// 1. Runtime resolution of the inlined value.
{
  assert.equal(resolveApiBaseUrl('https://api.example.com/api/v1/', 'production'), 'https://api.example.com/api/v1');
  for (const missing of [undefined, '', '   ']) {
    assert.equal(resolveApiBaseUrl(missing, 'production'), null, 'production without a URL resolves to null, never localhost');
    assert.equal(resolveApiBaseUrl(missing, 'development'), LOCAL_DEVELOPMENT_API_URL, 'development keeps the localhost default');
  }
  assert.match(API_URL_NOT_CONFIGURED_MESSAGE, /NEXT_PUBLIC_API_URL/);
  console.log('✓ Production resolves a missing URL to null; development keeps localhost');
}

// 2. Build-time validation (next.config.js runs this for `next build`).
{
  const refused = (env: Record<string, string>, pattern: RegExp) => {
    const result = validateApiUrlForBuild(env);
    assert.ok(result.problem, `${JSON.stringify(env)} should be refused`);
    assert.match(result.problem, pattern);
    assert.equal(result.url, null);
  };
  refused({}, /not set/);
  refused({ VERCEL: '1', NEXT_PUBLIC_API_URL: 'http://api.example.com/api/v1' }, /https on Vercel/);
  refused({ VERCEL: '1', NEXT_PUBLIC_API_URL: 'https://localhost:4000/api/v1' }, /localhost on Vercel/);
  refused({ NEXT_PUBLIC_API_URL: 'https://user:pass@api.example.com/api/v1' }, /credentials/);

  assert.deepEqual(validateApiUrlForBuild({ VERCEL: '1', NEXT_PUBLIC_API_URL: 'https://tenderbazaar-api.onrender.com/api/v1/' }), {
    url: 'https://tenderbazaar-api.onrender.com/api/v1',
    problem: null,
  });
  assert.deepEqual(validateApiUrlForBuild({ NEXT_PUBLIC_API_URL: 'http://localhost:4000/api/v1' }), {
    url: 'http://localhost:4000/api/v1',
    problem: null,
  });
  console.log('✓ Production builds refuse a missing or unsafe NEXT_PUBLIC_API_URL; Vercel builds need a public https API');
}

// 3. Both API consumers fail loudly without the URL, and nothing else in the
//    app knows the development address.
{
  const libDir = join(__dirname, '..');
  for (const file of ['api.ts', 'auth.ts']) {
    const src = readFileSync(join(libDir, file), 'utf8');
    assert.ok(src.includes('API_URL_NOT_CONFIGURED_MESSAGE'), `${file} must refuse to call anywhere when the URL is missing`);
    assert.ok(!/localhost/.test(src), `${file} must not carry a localhost fallback`);
  }

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

console.log('--- All Admin API URL Configuration Tests Passed ---');
