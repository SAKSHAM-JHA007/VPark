// Pool adapter over PGlite (the PostgreSQL engine compiled to WebAssembly, running
// in-process). It speaks real PostgreSQL SQL, types, constraints and transactions,
// but has a single connection: transactions from concurrent callers are queued, so
// it cannot demonstrate cross-connection row locking. That is covered by the real
// PostgreSQL server tests (test/data-store-postgres-server.test.mjs).
import { PGlite } from '@electric-sql/pglite';
import { runMigrations } from '../../src/lib/data/migrations.mjs';

function isMultiStatement(text) {
  return text.replace(/;\s*$/, '').includes(';');
}

export async function createPglitePool({ dataDir, migrate = true } = {}) {
  const pg = dataDir ? new PGlite(dataDir) : new PGlite();
  await pg.waitReady;

  async function run(text, params) {
    if (params === undefined && isMultiStatement(text)) {
      const results = await pg.exec(text);
      const last = results[results.length - 1];
      return { rows: last?.rows ?? [], rowCount: last?.affectedRows ?? 0 };
    }
    const r = await pg.query(text, params ?? []);
    return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
  }

  // One logical connection at a time (PGlite is single-connection).
  let tail = Promise.resolve();
  const pool = {
    stats: { connects: 0 },
    async connect() {
      let release;
      const held = new Promise((resolve) => (release = resolve));
      const previous = tail;
      tail = previous.then(() => held);
      await previous;
      pool.stats.connects += 1;
      return { query: run, release: () => release() };
    },
    async end() {
      await tail;
      await pg.close();
    },
    raw: pg,
  };

  if (migrate) {
    const client = await pool.connect();
    try {
      await runMigrations(client);
    } finally {
      client.release();
    }
  }
  return pool;
}
