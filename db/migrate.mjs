#!/usr/bin/env node
// Apply VPark's PostgreSQL schema migrations.
//
//   npm run db:migrate            apply pending migrations to DATABASE_URL
//   npm run db:migrate -- --status   show the current and expected schema version
//
// Reads DATABASE_URL (or POSTGRES_URL) from the environment / .env.local. Never
// touches local JSON or SQLite files. Safe to run repeatedly and concurrently
// (migrations are serialized with an advisory lock and applied in transactions).
import pg from 'pg';
import { resolveDataBackend } from '../src/lib/data/config.mjs';
import { getSchemaVersion, LATEST_SCHEMA_VERSION, runMigrations } from '../src/lib/data/migrations.mjs';

const statusOnly = process.argv.includes('--status');
const url = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();
if (!url) {
  console.error('DATABASE_URL (or POSTGRES_URL) is not set. Nothing was changed.');
  process.exit(1);
}

const backend = resolveDataBackend(process.env);
if (backend.kind !== 'postgres') {
  console.error(`Invalid database configuration: ${backend.error}`);
  process.exit(1);
}
const host = new URL(url).hostname;
const loopback = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
// Remote databases always use verified TLS from this tool, whatever NODE_ENV is.
const ssl = backend.ssl ?? (loopback ? undefined : { rejectUnauthorized: true });

const client = new pg.Client({ connectionString: url, ssl, application_name: 'vpark-migrate' });
try {
  await client.connect();
  const before = await getSchemaVersion(client);
  if (statusOnly) {
    console.log(`Schema version: ${before} (expected ${LATEST_SCHEMA_VERSION})${before < LATEST_SCHEMA_VERSION ? ' — migrations pending' : ''}`);
  } else {
    const applied = await runMigrations(client, { log: (m) => console.log(m) });
    console.log(applied.length ? `Applied migrations: ${applied.join(', ')}` : `Schema already up to date (version ${before}).`);
  }
} catch (err) {
  // Print the reason without echoing the connection string.
  console.error(`Migration failed: ${err && err.message ? err.message : err}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
