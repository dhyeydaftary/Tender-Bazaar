import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { validateDeploymentEnvironment } from '../config/env';

/**
 * Service-to-service authentication towards the Python AI service.
 *
 * The AI service used to accept any caller. It now requires a bearer token
 * (packages/ai-service/app/auth.py); this suite pins the API server's side:
 * the token is attached to every AI call, lives only on the server, and a
 * placeholder cannot reach production.
 */

console.log('--- Starting AI Service Client Tests ---');

const SRC = join(__dirname, '..');

// 1. Every call to the AI service carries the service headers.
{
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        if (entry !== 'tests') walk(path);
        continue;
      }
      if (!path.endsWith('.ts')) continue;
      const text = readFileSync(path, 'utf8');
      const calls = text.match(/env\.AI_SERVICE_URL\}[^`]*`/g) ?? [];
      if (calls.length === 0) continue;
      // Each axios.post(`${env.AI_SERVICE_URL}/...`, body, options) must pass
      // aiServiceHeaders() in its options.
      const blocks = text.split('env.AI_SERVICE_URL').slice(1);
      for (const block of blocks) {
        const optionsEnd = block.indexOf(');');
        if (!block.slice(0, optionsEnd).includes('aiServiceHeaders()')) offenders.push(path);
      }
    }
  };
  walk(SRC);
  assert.deepEqual(offenders, [], 'every AI service call must send aiServiceHeaders()');
  console.log('✓ Every AI service request carries the service token headers');
}

// 2. The header helper, under a configured and an unconfigured token.
{
  const load = (token: string | undefined) => {
    if (token === undefined) delete process.env.AI_SERVICE_TOKEN;
    else process.env.AI_SERVICE_TOKEN = token;
    process.env.NODE_ENV = 'development';
    for (const mod of ['../config/env', '../config/ai-service']) delete require.cache[require.resolve(mod)];
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../config/ai-service') as typeof import('../config/ai-service');
  };
  const withToken = load('a-shared-secret-of-sufficient-length');
  assert.deepEqual(withToken.aiServiceHeaders(), { Authorization: 'Bearer a-shared-secret-of-sufficient-length' });
  assert.equal(withToken.isAiServiceTokenConfigured(), true);
  const without = load(undefined);
  assert.deepEqual(without.aiServiceHeaders(), {}, 'no token, no header (the AI service then answers 503 and the API falls back)');
  assert.equal(without.isAiServiceTokenConfigured(), false);
  const blank = load('   ');
  assert.equal(blank.isAiServiceTokenConfigured(), false, 'whitespace is not a token');
  console.log('✓ The bearer header is sent when a token is configured and never fabricated when it is not');
}

// 3. Production refuses development and placeholder tokens; the browser never sees it.
{
  const base = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://app:Real-Db-Pass-123@db.internal:5432/tenderbazaar',
    REDIS_URL: 'rediss://default:Real-Redis-Pass-456@redis.internal:6379',
    FRONTEND_URL: 'https://app.tenderbazaar.example',
  };
  assert.deepEqual(validateDeploymentEnvironment(base), [], 'unset is allowed (AI calls disabled)');
  assert.deepEqual(validateDeploymentEnvironment({ ...base, AI_SERVICE_TOKEN: 'k7Qf2pLx9VzT4mNc8RbJ1hYw6sDgU3aE' }), []);
  for (const bad of ['dev-ai-service-token', 'short', 'change-me-please-now', 'your-ai-token-here-xx']) {
    const problems = validateDeploymentEnvironment({ ...base, AI_SERVICE_TOKEN: bad });
    assert.ok(problems.some((p) => p.startsWith('AI_SERVICE_TOKEN:')), `${bad} must be refused in production`);
    assert.ok(!problems.join('\n').includes(bad), 'the token value is never echoed');
  }

  const repoRoot = join(SRC, '..', '..', '..');
  for (const app of ['web', 'admin']) {
    const walk = (dir: string): string[] => {
      const hits: string[] = [];
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
          if (entry !== 'node_modules' && entry !== '.next') hits.push(...walk(path));
        } else if (/\.(ts|tsx|js)$/.test(entry) && /AI_SERVICE_TOKEN/.test(readFileSync(path, 'utf8'))) {
          hits.push(path);
        }
      }
      return hits;
    };
    assert.deepEqual(walk(join(repoRoot, 'apps', app)), [], `apps/${app} must never reference the AI service token`);
  }
  const envExample = readFileSync(join(repoRoot, '.env.example'), 'utf8');
  assert.ok(!/NEXT_PUBLIC_[A-Z_]*AI_SERVICE_TOKEN/.test(envExample), 'the token is never documented as a NEXT_PUBLIC_* value');
  console.log('✓ Production rejects placeholder tokens; the token exists only on the server side');
}

console.log('--- All AI Service Client Tests Passed ---');
