import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The broadcast_campaigns table is owned by a Prisma migration.
 *
 * It used to be created at request time by the admin notifications service
 * with a raw CREATE TABLE IF NOT EXISTS, so it existed in no schema and no
 * migration. This suite checks that the runtime DDL is gone, that a migration
 * exists, and that the migration's table definition is exactly what Prisma
 * itself generates for the BroadcastCampaign model (so the model, the SQL and
 * the raw queries agree). Prisma renders the schema's SQL offline
 * (`migrate diff --from-empty`), so no database is needed.
 */

console.log('--- Starting Broadcast Campaigns Migration Tests ---');

const REPO_ROOT = join(__dirname, '..', '..', '..', '..');
const MIGRATIONS = join(REPO_ROOT, 'prisma', 'migrations');
const API_SRC = join(__dirname, '..');

/** The CREATE TABLE statement for a table, normalised for comparison. */
function createTableOf(sql: string, table: string): string | null {
  const match = sql.match(new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?"${table}" \\(([\\s\\S]*?)\\);`));
  if (!match) return null;
  return match[1]
    .split('\n')
    .map((line) => line.trim().replace(/,$/, ''))
    .filter(Boolean)
    .sort()
    .join('\n');
}

// 1. No runtime DDL remains in the API server.
{
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'tests') walk(path);
      } else if (path.endsWith('.ts')) {
        // Comments may mention the old DDL; code may not contain it.
        const code = readFileSync(path, 'utf8')
          .split('\n')
          .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
          .join('\n');
        if (/CREATE TABLE/i.test(code)) offenders.push(path);
      }
    }
  };
  walk(API_SRC);
  assert.deepEqual(offenders, [], 'the API server must not create tables at runtime');
  console.log('✓ No CREATE TABLE remains in the API server source');
}

// 2. A migration exists and is idempotent against databases that already have the table.
const migrationDir = readdirSync(MIGRATIONS).find((name) => name.endsWith('_broadcast_campaigns'));
assert.ok(migrationDir, 'a *_broadcast_campaigns migration directory exists');
const migrationSql = readFileSync(join(MIGRATIONS, migrationDir!, 'migration.sql'), 'utf8');
{
  assert.ok(/CREATE TABLE IF NOT EXISTS "broadcast_campaigns"/.test(migrationSql), 'IF NOT EXISTS keeps existing data on databases that got the table from the old runtime DDL');
  assert.ok(!/DROP TABLE|DROP COLUMN|TRUNCATE/i.test(migrationSql), 'the migration never drops anything');
  assert.ok(existsSync(join(MIGRATIONS, 'migration_lock.toml')));
  console.log(`✓ Migration ${migrationDir} creates the table idempotently and drops nothing`);
}

// 3. The migration matches what Prisma generates for the model.
{
  const diff = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['prisma', 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'],
    { cwd: REPO_ROOT, encoding: 'utf8', shell: process.platform === 'win32', timeout: 120_000 },
  );
  assert.equal(diff.status, 0, `prisma migrate diff must run: ${diff.stderr}`);
  const fromSchema = createTableOf(diff.stdout, 'broadcast_campaigns');
  const fromMigration = createTableOf(migrationSql, 'broadcast_campaigns');
  assert.ok(fromSchema, 'the schema defines broadcast_campaigns (BroadcastCampaign model)');
  assert.ok(fromMigration, 'the migration defines broadcast_campaigns');
  assert.equal(fromMigration, fromSchema, 'migration SQL and schema-generated SQL must define the same columns, defaults and key');

  // And the raw queries in the API use exactly these columns.
  const expectedColumns = ['id', 'title', 'message', 'channel', 'target', 'status', 'delivered', 'failed', 'opened', 'sent_at', 'created_at'];
  for (const column of expectedColumns) {
    assert.ok(fromSchema!.includes(`"${column}"`), `column ${column} is in the model`);
  }
  const adminService = readFileSync(join(API_SRC, 'modules', 'admin', 'services', 'notifications.service.ts'), 'utf8');
  const insert = adminService.match(/INSERT INTO broadcast_campaigns \(([^)]*)\)/);
  assert.ok(insert, 'the admin service inserts into broadcast_campaigns');
  for (const column of insert![1].split(',').map((c) => c.trim())) {
    assert.ok(expectedColumns.includes(column), `inserted column ${column} exists in the model`);
  }
  console.log('✓ The migration is exactly the SQL Prisma generates for the model, and the raw queries use its columns');
}

console.log('--- All Broadcast Campaigns Migration Tests Passed ---');
