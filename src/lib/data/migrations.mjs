// PostgreSQL schema migrations for VPark.
//
// Migrations are applied explicitly (`npm run db:migrate`, or by tests), never
// automatically by the web application. At runtime the app only *checks* that the
// schema is at LATEST_SCHEMA_VERSION and fails closed (503) if it is not.
//
// Design: one table per collection. Each row stores the complete domain object in
// `data jsonb` (so nested pricing, capacity, documents, vehicles etc. round-trip
// unchanged) plus typed, constrained copies of the fields used for lookups,
// uniqueness, foreign keys and row locking. `seq` preserves insertion order.

const LISTING_STATUSES = `'DRAFT','PENDING_REVIEW','NEEDS_INFO','VERIFIED','REJECTED','SUSPENDED'`;
const BOOKING_STATUSES = `'PENDING_PAYMENT','CONFIRMED','CHECKED_IN','COMPLETED','CANCELLED_BY_DRIVER','CANCELLED_BY_PROVIDER','NO_SHOW','OVERSTAY','DISPUTED','EXPIRED'`;
const CATEGORIES = `'PRIVATE','COMMERCIAL','OTHER','PUBLIC'`;

const base = `seq bigserial NOT NULL, id text PRIMARY KEY CHECK (length(id) > 0), data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object')`;

export const MIGRATIONS = Object.freeze([
  {
    version: 1,
    name: 'initial_application_schema',
    sql: `
CREATE TABLE vp_users (
  ${base},
  email text,
  firebase_uid text,
  phone text
);
CREATE UNIQUE INDEX vp_users_firebase_uid_key ON vp_users (firebase_uid) WHERE firebase_uid IS NOT NULL;
CREATE INDEX vp_users_email_idx ON vp_users (email);
CREATE INDEX vp_users_phone_idx ON vp_users (phone);

CREATE TABLE vp_user_roles (
  ${base},
  user_id text NOT NULL REFERENCES vp_users (id) ON DELETE CASCADE,
  role_name text NOT NULL CHECK (role_name IN ('DRIVER','PROVIDER','ADMIN')),
  UNIQUE (user_id, role_name)
);

CREATE TABLE vp_provider_profiles (${base}, FOREIGN KEY (id) REFERENCES vp_users (id) ON DELETE CASCADE);
CREATE TABLE vp_driver_profiles (${base}, FOREIGN KEY (id) REFERENCES vp_users (id) ON DELETE CASCADE);

CREATE TABLE vp_consents (
  ${base},
  user_id text NOT NULL REFERENCES vp_users (id) ON DELETE CASCADE
);
CREATE INDEX vp_consents_user_idx ON vp_consents (user_id);

CREATE TABLE vp_otp_challenges (${base});

CREATE TABLE vp_listings (
  ${base},
  provider_id text NOT NULL REFERENCES vp_users (id),
  status text NOT NULL CHECK (status IN (${LISTING_STATUSES})),
  category text NOT NULL CHECK (category IN (${CATEGORIES}))
);
CREATE INDEX vp_listings_provider_idx ON vp_listings (provider_id);
CREATE INDEX vp_listings_status_idx ON vp_listings (status);

CREATE TABLE vp_listing_verifications (
  ${base},
  listing_id text NOT NULL REFERENCES vp_listings (id) ON DELETE CASCADE
);
CREATE INDEX vp_listing_verifications_listing_idx ON vp_listing_verifications (listing_id);

CREATE TABLE vp_holds (
  ${base},
  listing_id text NOT NULL REFERENCES vp_listings (id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES vp_users (id),
  expires_at timestamptz NOT NULL
);
CREATE INDEX vp_holds_listing_idx ON vp_holds (listing_id);
CREATE INDEX vp_holds_expires_idx ON vp_holds (expires_at);

CREATE TABLE vp_bookings (
  ${base},
  listing_id text NOT NULL REFERENCES vp_listings (id),
  driver_id text NOT NULL REFERENCES vp_users (id),
  provider_id text NOT NULL REFERENCES vp_users (id),
  reference_number text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN (${BOOKING_STATUSES}))
);
CREATE INDEX vp_bookings_listing_status_idx ON vp_bookings (listing_id, status);
CREATE INDEX vp_bookings_driver_idx ON vp_bookings (driver_id);
CREATE INDEX vp_bookings_provider_idx ON vp_bookings (provider_id);

CREATE TABLE vp_payments (
  ${base},
  booking_id text NOT NULL REFERENCES vp_bookings (id)
);
CREATE INDEX vp_payments_booking_idx ON vp_payments (booking_id);

CREATE TABLE vp_payouts (
  ${base},
  provider_id text NOT NULL REFERENCES vp_users (id)
);
CREATE INDEX vp_payouts_provider_idx ON vp_payouts (provider_id);

CREATE TABLE vp_disputes (
  ${base},
  booking_id text NOT NULL REFERENCES vp_bookings (id),
  raised_by_user_id text NOT NULL REFERENCES vp_users (id),
  against_user_id text NOT NULL REFERENCES vp_users (id)
);
CREATE INDEX vp_disputes_booking_idx ON vp_disputes (booking_id);
CREATE INDEX vp_disputes_raised_by_idx ON vp_disputes (raised_by_user_id);
CREATE INDEX vp_disputes_against_idx ON vp_disputes (against_user_id);

CREATE TABLE vp_audit_logs (
  ${base},
  actor_id text NOT NULL
);
CREATE INDEX vp_audit_logs_seq_idx ON vp_audit_logs (seq DESC);
CREATE INDEX vp_audit_logs_actor_idx ON vp_audit_logs (actor_id);

CREATE TABLE vp_reviews (
  ${base},
  listing_id text NOT NULL REFERENCES vp_listings (id) ON DELETE CASCADE
);
CREATE INDEX vp_reviews_listing_idx ON vp_reviews (listing_id);

CREATE TABLE vp_monthly_passes (
  ${base},
  listing_id text NOT NULL REFERENCES vp_listings (id),
  driver_id text NOT NULL REFERENCES vp_users (id)
);
CREATE INDEX vp_monthly_passes_driver_idx ON vp_monthly_passes (driver_id);
CREATE INDEX vp_monthly_passes_listing_idx ON vp_monthly_passes (listing_id);

CREATE TABLE vp_contact_messages (${base});

-- Sessions keyed by HMAC-SHA256(SESSION_SECRET, token); raw tokens are never stored.
CREATE TABLE vp_sessions (
  ${base},
  user_id text NOT NULL REFERENCES vp_users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL
);
CREATE INDEX vp_sessions_user_idx ON vp_sessions (user_id);
CREATE INDEX vp_sessions_expires_idx ON vp_sessions (expires_at);
CREATE INDEX vp_sessions_last_seen_idx ON vp_sessions (last_seen_at);
`,
  },
]);

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

// Arbitrary constant key so concurrent migrators (e.g. parallel deploys) serialize.
const MIGRATION_LOCK_KEY = 74_201_119;

/**
 * Apply pending migrations. `client` must be a single connection exposing
 * `query(text, params?)` (node-postgres Client / PoolClient, or a compatible adapter).
 * Returns the versions applied.
 */
export async function runMigrations(client, { log = () => {} } = {}) {
  await client.query(`SELECT pg_advisory_lock(${MIGRATION_LOCK_KEY})`);
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS vp_schema_migrations (
      version integer PRIMARY KEY,
      name text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const { rows } = await client.query('SELECT COALESCE(MAX(version), 0) AS version FROM vp_schema_migrations');
    const current = Number(rows[0].version);
    const applied = [];
    for (const m of MIGRATIONS) {
      if (m.version <= current) continue;
      log(`Applying migration ${m.version} (${m.name})`);
      await client.query('BEGIN');
      try {
        await client.query(m.sql);
        await client.query('INSERT INTO vp_schema_migrations (version, name) VALUES ($1, $2)', [m.version, m.name]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      }
      applied.push(m.version);
    }
    return applied;
  } finally {
    await client.query(`SELECT pg_advisory_unlock(${MIGRATION_LOCK_KEY})`).catch(() => {});
  }
}

/** Current schema version, or 0 if the migrations table does not exist yet. */
export async function getSchemaVersion(client) {
  const exists = await client.query(`SELECT to_regclass('vp_schema_migrations') IS NOT NULL AS present`);
  if (!exists.rows[0].present) return 0;
  const { rows } = await client.query('SELECT COALESCE(MAX(version), 0) AS version FROM vp_schema_migrations');
  return Number(rows[0].version);
}
