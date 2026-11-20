import { COLLECTIONS, columnValue, type CollectionName, type CollectionTypes, type ColumnSpec } from './collections.mjs';
import { getSchemaVersion, LATEST_SCHEMA_VERSION } from './migrations.mjs';
import { DataStoreUnavailableError, type DataStore, type Filter, type ReadOptions, type Tx } from './store';

/** Minimal connection surface used by the store (satisfied by a node-postgres Pool). */
export interface PgClientLike {
  query(text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount?: number | null }>;
  release(destroy?: boolean | Error): void;
}
export interface PgPoolLike {
  connect(): Promise<PgClientLike>;
  end(): Promise<void>;
}

// SQLSTATEs worth retrying the whole transaction for.
const RETRYABLE = new Set(['40001', '40P01']); // serialization_failure, deadlock_detected
const MAX_ATTEMPTS = 4;

/** Errors that mean "the database cannot serve requests" (fail closed with 503). */
function isUnavailable(err: any): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = String(err.code || '');
  return (
    ['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN', 'EHOSTUNREACH', 'EPIPE'].includes(code) ||
    code.startsWith('08') || // connection_exception
    code.startsWith('28') || // invalid_authorization_specification
    code.startsWith('3D') || // invalid_catalog_name (database does not exist)
    code === '57P01' || // admin_shutdown
    code === '57P03' || // cannot_connect_now
    code === '53300' || // too_many_connections
    code === '42P01' || // undefined_table: schema missing
    /timeout|terminated|Connection terminated/i.test(String(err.message || ''))
  );
}

function spec(kind: CollectionName) {
  const s = COLLECTIONS[kind];
  if (!s) throw new Error(`Unknown collection ${kind}`);
  return s;
}

function columnFor(kind: CollectionName, field: string): ColumnSpec {
  if (field === 'id') return { column: 'id', type: 'text' };
  const c = spec(kind).columns[field];
  if (!c) throw new Error(`Field "${field}" is not an indexed column of ${kind}; add it to collections.mjs.`);
  return c;
}

function buildWhere(kind: CollectionName, where: Filter, params: unknown[]): string {
  const clauses: string[] = [];
  for (const [field, cond] of Object.entries(where)) {
    const col = columnFor(kind, field);
    const cast = col.type === 'timestamptz' ? '::timestamptz' : '';
    const p = (v: unknown) => {
      params.push(v);
      return `$${params.length}${cast}`;
    };
    if (cond === null) {
      clauses.push(`${col.column} IS NULL`);
    } else if (typeof cond === 'string') {
      clauses.push(`${col.column} = ${p(columnValue(col, cond))}`);
    } else if (Array.isArray(cond)) {
      if (cond.length === 0) {
        clauses.push('FALSE');
      } else {
        params.push(cond.map((v) => columnValue(col, v)));
        clauses.push(`${col.column} = ANY($${params.length}${cast ? '::timestamptz[]' : '::text[]'})`);
      }
    } else {
      const range = cond as { lte?: string; lt?: string; gte?: string; gt?: string };
      if (range.lte !== undefined) clauses.push(`${col.column} <= ${p(range.lte)}`);
      if (range.lt !== undefined) clauses.push(`${col.column} < ${p(range.lt)}`);
      if (range.gte !== undefined) clauses.push(`${col.column} >= ${p(range.gte)}`);
      if (range.gt !== undefined) clauses.push(`${col.column} > ${p(range.gt)}`);
    }
  }
  return clauses.length ? clauses.join(' AND ') : 'TRUE';
}

function orderBy(kind: CollectionName): string {
  return spec(kind).newestFirst ? 'seq DESC' : 'seq ASC';
}

function createTx(client: PgClientLike): Tx {
  return {
    async get(kind, key, opts?: ReadOptions) {
      const { rows } = await client.query(
        `SELECT data FROM ${spec(kind).table} WHERE id = $1${opts?.forUpdate ? ' FOR UPDATE' : ''}`,
        [key]
      );
      return rows[0]?.data;
    },

    async find(kind, where, opts?: ReadOptions) {
      const params: unknown[] = [];
      const sql = `SELECT data FROM ${spec(kind).table} WHERE ${buildWhere(kind, where, params)} ORDER BY ${orderBy(kind)}${
        opts?.forUpdate ? ' FOR UPDATE' : ''
      }`;
      const { rows } = await client.query(sql, params);
      return rows.map((r) => r.data);
    },

    async all(kind) {
      const { rows } = await client.query(`SELECT data FROM ${spec(kind).table} ORDER BY ${orderBy(kind)}`);
      return rows.map((r) => r.data);
    },

    async put(kind, entity) {
      const s = spec(kind);
      const key = s.key(entity as never);
      if (typeof key !== 'string' || !key) throw new Error(`Cannot store ${kind} without a key.`);
      const cols = Object.entries(s.columns);
      const names = ['id', 'data', ...cols.map(([, c]) => c.column)];
      const params: unknown[] = [key, JSON.stringify(entity)];
      const values = ['$1', '$2::jsonb'];
      for (const [field, c] of cols) {
        params.push(columnValue(c, (entity as unknown as Record<string, unknown>)[field]));
        values.push(`$${params.length}${c.type === 'timestamptz' ? '::timestamptz' : ''}`);
      }
      const updates = names.slice(1).map((n) => `${n} = EXCLUDED.${n}`).join(', ');
      await client.query(
        `INSERT INTO ${s.table} (${names.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT (id) DO UPDATE SET ${updates}`,
        params
      );
    },

    async delete(kind, key) {
      const res = await client.query(`DELETE FROM ${spec(kind).table} WHERE id = $1`, [key]);
      return (res.rowCount ?? 0) > 0;
    },

    async deleteWhere(kind, where) {
      const params: unknown[] = [];
      const res = await client.query(`DELETE FROM ${spec(kind).table} WHERE ${buildWhere(kind, where, params)}`, params);
      return res.rowCount ?? 0;
    },

    async lock(key) {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
    },
  };
}

/**
 * PostgreSQL-backed application data store. Every call to `transaction` runs in a
 * single database transaction on one pooled connection: all writes commit together
 * or not at all. Critical sections take row locks (FOR UPDATE) or advisory locks, so
 * concurrent requests on any number of serverless instances see consistent data.
 */
export function createPostgresStore(pool: PgPoolLike): DataStore {
  let schemaChecked = false;

  async function ensureSchema(client: PgClientLike) {
    if (schemaChecked) return;
    const version = await getSchemaVersion(client);
    if (version < LATEST_SCHEMA_VERSION) {
      throw new DataStoreUnavailableError(
        `database schema is at version ${version}, expected ${LATEST_SCHEMA_VERSION}. Run "npm run db:migrate".`
      );
    }
    schemaChecked = true;
  }

  return {
    kind: 'postgres',

    async transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      for (let attempt = 1; ; attempt++) {
        let client: PgClientLike;
        try {
          client = await pool.connect();
        } catch (err) {
          throw new DataStoreUnavailableError('could not connect to PostgreSQL', { cause: err });
        }
        let broken = false;
        try {
          await ensureSchema(client);
          await client.query('BEGIN');
          const result = await fn(createTx(client));
          await client.query('COMMIT');
          return result;
        } catch (err: any) {
          await client.query('ROLLBACK').catch(() => {
            broken = true;
          });
          if (err instanceof DataStoreUnavailableError) throw err;
          if (RETRYABLE.has(String(err?.code)) && attempt < MAX_ATTEMPTS) {
            await new Promise((r) => setTimeout(r, 10 * attempt + Math.random() * 25));
            continue;
          }
          if (isUnavailable(err)) {
            broken = true;
            throw new DataStoreUnavailableError(
              String(err.code) === '42P01' ? 'database schema is missing. Run "npm run db:migrate".' : 'PostgreSQL request failed',
              { cause: err }
            );
          }
          throw err;
        } finally {
          client.release(broken);
        }
      }
    },

    async close() {
      await pool.end();
    },
  };
}

/** Create a node-postgres pool for the configured database (production driver). */
export async function createPgPool(config: {
  connectionString: string;
  ssl?: { rejectUnauthorized: boolean };
  poolMax: number;
}): Promise<PgPoolLike> {
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: config.connectionString,
    ssl: config.ssl,
    max: config.poolMax,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 15_000,
    idle_in_transaction_session_timeout: 30_000,
    application_name: 'vpark',
  });
  // An idle client error must not crash the process; the next query reconnects.
  pool.on('error', (err) => console.error('[db] Idle PostgreSQL client error:', err.message));
  return pool as unknown as PgPoolLike;
}

export type { CollectionTypes };
