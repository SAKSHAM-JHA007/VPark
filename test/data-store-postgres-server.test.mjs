// Data-layer tests against a REAL PostgreSQL SERVER (no mocks, no embedded engine).
//
// Runs only when VPARK_TEST_DATABASE_URL points at a disposable PostgreSQL database
// (e.g. a local server or a CI service container). Each run works in a fresh,
// randomly named schema that is dropped afterwards. Otherwise every test is SKIPPED
// and reported as skipped.
//
// This is the tier that proves cross-connection behaviour: every "instance" is a
// separate connection pool, and one test races separate OS processes for the last
// parking slot, so row locks (SELECT … FOR UPDATE) and advisory locks are exercised
// for real.
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import './support/register-ts.mjs';

const exec = promisify(execFile);
const BASE_URL = process.env.VPARK_TEST_DATABASE_URL;

if (!BASE_URL) {
  describe('Real PostgreSQL server', () => {
    it('is not configured (set VPARK_TEST_DATABASE_URL to run these tests)', { skip: 'VPARK_TEST_DATABASE_URL is not set' }, () => {});
  });
} else {
  const pg = (await import('pg')).default;
  const { defineDataStoreSuite } = await import('./support/data-store-suite.mjs');
  const { seedVerifiedListing } = await import('./support/harness.mjs');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vpark-pg-server-'));
  const schema = `vpark_test_${crypto.randomBytes(5).toString('hex')}`;
  const url = new URL(BASE_URL);
  url.searchParams.set('options', `-c search_path=${schema}`);
  const schemaUrl = url.toString();

  const admin = new pg.Client({ connectionString: BASE_URL });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);

  process.env.NODE_ENV = 'test';
  process.env.VPARK_DATA_DIR = path.join(tmp, 'local-data-must-stay-empty');
  process.env.DATABASE_URL = schemaUrl;
  process.env.SESSION_SECRET = crypto.randomBytes(48).toString('base64url');
  for (const k of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']) delete process.env[k];

  // Apply the schema with the real CLI, exactly as a deployment would.
  const cli = fileURLToPath(new URL('../db/migrate.mjs', import.meta.url));
  const migrated = await exec(process.execPath, [cli], { env: { ...process.env, DATABASE_URL: schemaUrl } });

  const { createPgPool, createPostgresStore } = await import('../src/lib/data/postgres-store.ts');
  const { Database } = await import('../src/lib/db.ts');
  const pools = [];
  const newStore = async () => {
    const pool = await createPgPool({ connectionString: schemaUrl, poolMax: 3 });
    pools.push(pool);
    return createPostgresStore(pool);
  };

  after(async () => {
    const { db } = await import('../src/lib/db.ts');
    if ((await db.backendKind().catch(() => null)) === 'postgres') {
      // close the app singleton's pool
      const stores = globalThis.vparkPgStores;
      for (const p of stores?.values() ?? []) await (await p).close().catch(() => {});
    }
    for (const p of pools) await p.end().catch(() => {});
    await admin.query(`DROP SCHEMA ${schema} CASCADE`).catch(() => {});
    await admin.end();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  describe('Migrations on a real PostgreSQL server', () => {
    it('the migration CLI applied the schema and is idempotent', async () => {
      assert.match(migrated.stdout, /Applied migrations: 1/);
      const again = await exec(process.execPath, [cli], { env: { ...process.env, DATABASE_URL: schemaUrl } });
      assert.match(again.stdout, /already up to date/);
      const { rows } = await admin.query(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = $1`, [schema]);
      assert.ok(rows[0].n >= 19, `expected the VPark tables in ${schema}, found ${rows[0].n}`);
    });
  });

  await defineDataStoreSuite({
    label: 'real PostgreSQL server',
    newStore,
    postgres: true,
    concurrencyNote: 'separate connection pools, real row locks',
  });

  describe('Separate processes (independent instances) on a real PostgreSQL server', () => {
    it('exactly one of several processes racing for the last slot gets the booking', async () => {
      const db = new Database(await newStore());
      const listing = await seedVerifiedListing(db, { totalCapacity: 1 });
      const start = new Date(Date.now() + 40 * 3600_000).toISOString();
      const end = new Date(Date.now() + 42 * 3600_000).toISOString();
      const worker = fileURLToPath(new URL('./support/booking-instance-worker.mjs', import.meta.url));
      const goAt = Date.now() + 4000;
      const drivers = ['usr_driver_1', 'usr_owner_1', 'usr_admin_1', 'usr_driver_1', 'usr_owner_1', 'usr_admin_1'];
      const outputs = await Promise.all(
        drivers.map((d) =>
          exec(process.execPath, [worker, listing.id, d, start, end, String(goAt)], {
            env: { ...process.env, DATABASE_URL: schemaUrl, VPARK_DATA_DIR: path.join(tmp, `instance-${d}-${Math.random()}`) },
            timeout: 60_000,
          }).then(({ stdout }) => JSON.parse(stdout.trim().split('\n').pop()))
        )
      );
      assert.ok(outputs.every((o) => o.backend === 'postgres'));
      assert.equal(outputs.filter((o) => o.success).length, 1, JSON.stringify(outputs));
      const { rows } = await admin.query(
        `SELECT count(*)::int AS n FROM ${schema}.vp_bookings WHERE listing_id = $1 AND status = 'CONFIRMED'`,
        [listing.id]
      );
      assert.equal(rows[0].n, 1);
    });
  });

  describe('The app configured through DATABASE_URL (real PostgreSQL server)', () => {
    it('serves authenticated API requests from PostgreSQL, with sessions in PostgreSQL, and writes nothing locally', async () => {
      const { NextRequest } = await import('next/server.js');
      const auth = await import('../src/lib/auth.ts');
      const { db } = await import('../src/lib/db.ts');
      assert.equal(await db.backendKind(), 'postgres');
      await db.seedDemoData();

      const { token, record } = await auth.getSessionManager().createSession({ userId: 'usr_driver_1' });
      const { rows } = await admin.query(`SELECT user_id FROM ${schema}.vp_sessions WHERE id = $1`, [record.tokenHash]);
      assert.equal(rows[0]?.user_id, 'usr_driver_1');

      const userExport = await import('../src/app/api/user/export/route.ts');
      const res = await userExport.GET(
        new NextRequest('http://localhost:3000/api/user/export', { headers: { host: 'localhost:3000', cookie: `vpark_session=${token}` } })
      );
      assert.equal(res.status, 200);
      assert.equal(JSON.parse(await res.text()).userProfile.id, 'usr_driver_1');
      assert.equal(fs.existsSync(process.env.VPARK_DATA_DIR), false, 'no local data directory was created');
    });
  });
}
