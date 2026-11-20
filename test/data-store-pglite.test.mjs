// Data-layer tests on PGlite: the real PostgreSQL engine (compiled to WebAssembly)
// running in-process. NOT A MOCK: real SQL, schema migrations, jsonb, constraints,
// transactions and rollbacks. LIMITATION: PGlite has a single connection, so
// concurrent transactions are queued and cross-connection row locking is NOT proven
// here; see data-store-postgres-server.test.mjs for that (real PostgreSQL server).
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import './support/register-ts.mjs';
import { createPglitePool } from './support/pglite-pool.mjs';
import { defineDataStoreSuite } from './support/data-store-suite.mjs';
import { LATEST_SCHEMA_VERSION, getSchemaVersion, runMigrations } from '../src/lib/data/migrations.mjs';

process.env.NODE_ENV = 'test';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vpark-pglite-'));
process.env.VPARK_DATA_DIR = path.join(tmp, 'unused-json-dir');

const { createPostgresStore } = await import('../src/lib/data/postgres-store.ts');
const { Database, isDataStoreUnavailable } = await import('../src/lib/db.ts');

const pool = await createPglitePool();
after(async () => {
  await pool.end();
  fs.rmSync(tmp, { recursive: true, force: true });
});

await defineDataStoreSuite({
  label: 'PGlite (embedded PostgreSQL engine)',
  newStore: async () => createPostgresStore(pool),
  postgres: true,
  concurrencyNote: 'single connection: transactions queued',
});

describe('PostgreSQL schema & lifecycle (PGlite)', () => {
  it('migrations are idempotent and record the schema version', async () => {
    const client = await pool.connect();
    try {
      assert.equal(await getSchemaVersion(client), LATEST_SCHEMA_VERSION);
      assert.deepEqual(await runMigrations(client), []);
    } finally {
      client.release();
    }
  });

  it('data survives a database restart (file-backed PGlite closed and reopened)', async () => {
    const dir = path.join(tmp, 'restart-db');
    const first = await createPglitePool({ dataDir: dir });
    const a = new Database(createPostgresStore(first));
    await a.seedDemoData();
    await a.createContactMessage({ name: 'R', email: 'r@example.com', subject: 'Restart', message: 'Survives restart', ip: '', userAgent: '' });
    await first.end();

    const second = await createPglitePool({ dataDir: dir, migrate: false });
    const b = new Database(createPostgresStore(second));
    assert.equal((await b.getUserById('usr_driver_1')).name, 'Rajesh Kumar');
    const store = createPostgresStore(second);
    const messages = await store.transaction((tx) => tx.all('contactMessages'));
    assert.ok(messages.some((m) => m.message === 'Survives restart'));
    await second.end();
  });

  it('fails closed (DataStoreUnavailableError) when the schema has not been migrated', async () => {
    const empty = await createPglitePool({ migrate: false });
    const unmigrated = new Database(createPostgresStore(empty));
    await assert.rejects(unmigrated.getUserById('usr_driver_1'), (err) => isDataStoreUnavailable(err) && /npm run db:migrate/.test(err.message));
    await empty.end();
  });
});
