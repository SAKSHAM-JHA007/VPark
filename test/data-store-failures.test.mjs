// Failure-condition tests for the data layer. These USE MOCKS: fake connection pools
// stand in for PostgreSQL so connection loss, mid-transaction failures, deadlock
// retries and missing configuration can be triggered deterministically. They prove the
// application's handling of those conditions, not PostgreSQL's behaviour.
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import './support/register-ts.mjs';
import { resolveDataBackend } from '../src/lib/data/config.mjs';
import { LATEST_SCHEMA_VERSION } from '../src/lib/data/migrations.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vpark-failures-'));
process.env.NODE_ENV = 'test';
process.env.VPARK_DATA_DIR = tmp;
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const { createPostgresStore } = await import('../src/lib/data/postgres-store.ts');
const { isDataStoreUnavailable } = await import('../src/lib/db.ts');

/** Fake pool whose client answers the schema check, then runs `handler` for other SQL. */
function mockPool(handler, { schemaVersion = LATEST_SCHEMA_VERSION } = {}) {
  const log = [];
  const released = [];
  return {
    log,
    released,
    async connect() {
      return {
        async query(text, params) {
          log.push(text);
          if (text.includes('to_regclass')) return { rows: [{ present: schemaVersion > 0 }] };
          if (text.includes('MAX(version)')) return { rows: [{ version: schemaVersion }] };
          if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(text)) return { rows: [] };
          return handler(text, params);
        },
        release(destroy) {
          released.push(Boolean(destroy));
        },
      };
    },
    async end() {},
  };
}

describe('Data backend configuration (no database needed)', () => {
  it('fails closed in production without DATABASE_URL — never local JSON/SQLite', () => {
    const r = resolveDataBackend({ NODE_ENV: 'production' });
    assert.equal(r.kind, null);
    assert.match(r.error, /DATABASE_URL is not configured/);
  });

  it('uses the local JSON store only outside production, unless PostgreSQL is required explicitly', () => {
    assert.equal(resolveDataBackend({ NODE_ENV: 'development' }).kind, 'json');
    assert.equal(resolveDataBackend({ NODE_ENV: 'development', VPARK_DATA_STORE: 'postgres' }).kind, null);
  });

  it('accepts DATABASE_URL or POSTGRES_URL and requires verified TLS for remote production databases', () => {
    const prod = resolveDataBackend({ NODE_ENV: 'production', DATABASE_URL: 'postgres://u:p@db.example.com:5432/vpark?sslmode=require' });
    assert.equal(prod.kind, 'postgres');
    assert.deepEqual(prod.ssl, { rejectUnauthorized: true });
    assert.equal(resolveDataBackend({ NODE_ENV: 'production', POSTGRES_URL: 'postgresql://u:p@db.example.com/vpark' }).kind, 'postgres');
    assert.equal(resolveDataBackend({ NODE_ENV: 'production', DATABASE_URL: 'postgres://u:p@db.example.com/vpark?sslmode=disable' }).kind, null);
    assert.equal(resolveDataBackend({ NODE_ENV: 'production', DATABASE_URL: 'mysql://u:p@db.example.com/vpark' }).kind, null);
    assert.equal(resolveDataBackend({ NODE_ENV: 'production', DATABASE_URL: 'not a url' }).kind, null);
  });
});

describe('PostgreSQL store failure handling (mocked pools)', () => {
  it('reports an unreachable database as unavailable', async () => {
    const pool = { connect: async () => Promise.reject(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })), end: async () => {} };
    await assert.rejects(createPostgresStore(pool).transaction(async () => 1), isDataStoreUnavailable);
  });

  it('refuses to run against an unmigrated schema', async () => {
    const pool = mockPool(() => ({ rows: [] }), { schemaVersion: 0 });
    await assert.rejects(createPostgresStore(pool).transaction(async () => 1), (err) => isDataStoreUnavailable(err) && /db:migrate/.test(err.message));
  });

  it('rolls back and discards the connection when it fails mid-transaction', async () => {
    const pool = mockPool(() => {
      throw Object.assign(new Error('terminating connection due to administrator command'), { code: '57P01' });
    });
    await assert.rejects(
      createPostgresStore(pool).transaction((tx) => tx.get('users', 'usr_driver_1')),
      isDataStoreUnavailable
    );
    assert.ok(pool.log.includes('ROLLBACK'));
    assert.ok(!pool.log.includes('COMMIT'));
    assert.deepEqual(pool.released, [true]);
  });

  it('retries the whole transaction after a deadlock or serialization failure', async () => {
    let calls = 0;
    const pool = mockPool(() => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error('deadlock detected'), { code: '40P01' });
      return { rows: [{ data: { id: 'usr_driver_1', name: 'Rajesh Kumar' } }] };
    });
    const user = await createPostgresStore(pool).transaction((tx) => tx.get('users', 'usr_driver_1'));
    assert.equal(user.name, 'Rajesh Kumar');
    assert.equal(calls, 2);
    assert.equal(pool.log.filter((q) => q === 'COMMIT').length, 1);
  });

  it('surfaces constraint violations as errors (not as "unavailable") and rolls back', async () => {
    const pool = mockPool(() => {
      throw Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
    });
    await assert.rejects(
      createPostgresStore(pool).transaction((tx) => tx.put('contactMessages', { id: 'm' })),
      (err) => err.code === '23505' && !isDataStoreUnavailable(err)
    );
    assert.ok(pool.log.includes('ROLLBACK'));
  });
});

describe('Production without a database: API routes fail closed (in-process app)', () => {
  it('returns 503 and writes nothing locally', async () => {
    const realDataFile = path.join(process.cwd(), '.data', 'vpark_database.json');
    const realMtime = fs.existsSync(realDataFile) ? fs.statSync(realDataFile).mtimeMs : null;
    const saved = { ...process.env };
    process.env.NODE_ENV = 'production';
    process.env.SESSION_SECRET = 'p'.repeat(48);
    process.env.FIREBASE_PROJECT_ID = 'vpark-test-project';
    for (const k of ['DATABASE_URL', 'POSTGRES_URL', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']) delete process.env[k];
    const errors = [];
    const origError = console.error;
    console.error = (...a) => errors.push(a.join(' '));
    try {
      const { NextRequest } = await import('next/server.js');
      const req = (method, url, body) =>
        new NextRequest(`http://localhost:3000${url}`, {
          method,
          headers: { host: 'localhost:3000', origin: 'http://localhost:3000', 'content-type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
        });

      const search = await import('../src/app/api/search/route.ts');
      assert.equal((await search.GET(req('GET', '/api/search'))).status, 503);

      const contact = await import('../src/app/api/contact/route.ts');
      const sent = await contact.POST(req('POST', '/api/contact', { name: 'Tester', email: 't@example.com', subject: 'Hello there', message: 'This should not be stored locally.' }));
      assert.equal(sent.status, 503);

      const { createGoogleSignInHandler } = await import('../src/lib/auth-google.ts');
      const signIn = await createGoogleSignInHandler({ verifier: async () => ({}) })(req('POST', '/api/auth/google', { idToken: 'a.b.c' }));
      assert.equal(signIn.status, 503);

      assert.ok(errors.some((e) => e.includes('DATABASE_URL is not configured')), 'a clear configuration error is logged');
      assert.deepEqual(fs.readdirSync(tmp), [], 'nothing was written to the local data directory');
      if (realMtime !== null) assert.equal(fs.statSync(realDataFile).mtimeMs, realMtime, 'the real .data file was not touched');
    } finally {
      console.error = origError;
      for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
      Object.assign(process.env, saved);
    }
  });
});
