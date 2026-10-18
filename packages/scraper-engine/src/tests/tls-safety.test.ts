import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Static guard against re-disabling TLS certificate verification.
 *
 * The scraper used to ship two independent bypasses:
 *   1. `new https.Agent({ rejectUnauthorized: false })` in base-scraper.ts,
 *      applied to every outbound request;
 *   2. `NODE_TLS_REJECT_UNAUTHORIZED=0` on the scraper service in
 *      docker-compose.yml, which disables verification process-wide and is
 *      inherited by the production override.
 *
 * Both are easy to reintroduce while chasing a portal with a broken chain, and
 * neither fails loudly. This test fails the build instead.
 */

console.log('--- Starting Scraper TLS Safety Tests ---');

const packageRoot = path.resolve(__dirname, '..', '..');
const repoRoot = path.resolve(packageRoot, '..', '..');

function walk(dir: string, extensions: string[]): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, extensions));
    else if (extensions.some((ext) => entry.name.endsWith(ext))) out.push(full);
  }
  return out;
}

// 1. No source file may hardcode `rejectUnauthorized: false`.
{
  const sources = walk(path.join(packageRoot, 'src'), ['.ts']);
  assert.ok(sources.length > 0, 'Expected to find scraper source files to scan');

  /** Code lines only: prose explaining the rule must not trip it. */
  const isComment = (line: string) => {
    const t = line.trim();
    return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
  };

  const offenders: string[] = [];
  for (const file of sources) {
    if (file.endsWith('tls-safety.test.ts')) continue;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    for (const [index, line] of lines.entries()) {
      if (isComment(line)) continue;
      if (/rejectUnauthorized\s*:\s*false/.test(line)) {
        offenders.push(`${path.relative(repoRoot, file)}:${index + 1}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `TLS verification is hardcoded off in: ${offenders.join(', ')}. ` +
      'Use NODE_EXTRA_CA_CERTS for a missing intermediate certificate, or the ' +
      'explicit SCRAPER_ALLOW_INSECURE_TLS escape hatch (which is inert in production).',
  );

  console.log(`✓ No hardcoded 'rejectUnauthorized: false' in ${sources.length} scraper sources`);
}

// 2. The shared agent must verify certificates by default.
{
  const baseScraper = fs.readFileSync(
    path.join(packageRoot, 'src', 'scrapers', 'base-scraper.ts'),
    'utf8',
  );

  assert.match(
    baseScraper,
    /rejectUnauthorized:\s*!allowInsecureTls/,
    'base-scraper.ts must derive rejectUnauthorized from the guarded flag',
  );
  assert.match(
    baseScraper,
    /process\.env\.NODE_ENV\s*!==\s*'production'/,
    'The insecure-TLS escape hatch must be disabled when NODE_ENV=production',
  );

  console.log('✓ The shared HTTPS agent verifies certificates unless explicitly, non-production-ly overridden');
}

// 3. No Compose file or Dockerfile may set NODE_TLS_REJECT_UNAUTHORIZED.
{
  const infraFiles = [
    'docker-compose.yml',
    'docker-compose.prod.yml',
    'docker-compose.override.yml',
    'packages/scraper-engine/Dockerfile',
    'packages/api-server/Dockerfile',
    'packages/notification-service/Dockerfile',
    'apps/web/Dockerfile',
    'apps/admin/Dockerfile',
    'docker/Dockerfile.db-init',
  ];

  const offenders: string[] = [];
  for (const rel of infraFiles) {
    const full = path.join(repoRoot, rel);
    if (!fs.existsSync(full)) continue;
    const text = fs.readFileSync(full, 'utf8');
    // Allow the name to appear in a comment explaining why it must not be set.
    for (const line of text.split('\n')) {
      const stripped = line.trim();
      if (stripped.startsWith('#')) continue;
      if (stripped.includes('NODE_TLS_REJECT_UNAUTHORIZED')) {
        offenders.push(`${rel}: ${stripped}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `NODE_TLS_REJECT_UNAUTHORIZED must not be set in infrastructure files: ${offenders.join(' | ')}`,
  );

  console.log(`✓ No NODE_TLS_REJECT_UNAUTHORIZED in ${infraFiles.length} infrastructure files`);
}

console.log('--- All Scraper TLS Safety Tests Passed ---');
