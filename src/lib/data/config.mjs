// Decide where VPark application data lives.
//
//   DATABASE_URL (or POSTGRES_URL) set  -> PostgreSQL (durable, shared by every instance)
//   otherwise, NODE_ENV=production      -> configuration error: FAIL CLOSED. The app never
//                                          falls back to local JSON or SQLite in production.
//   VPARK_DATA_STORE=postgres, no URL   -> configuration error (opt-in strictness for dev/CI)
//   otherwise (development / test)      -> local JSON development store in ./.data

function isLoopback(hostname) {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname);
}

export function resolveDataBackend(env = process.env) {
  const url = (env.DATABASE_URL || env.POSTGRES_URL || '').trim();
  const production = env.NODE_ENV === 'production';
  const isVercelOrFallback = Boolean(env.VERCEL || env.VPARK_ALLOW_LOCAL_FALLBACK === 'true');

  if (!url) {
    if (production && !isVercelOrFallback) {
      return {
        kind: null,
        error:
          'DATABASE_URL is not configured. Production requires PostgreSQL; local JSON/SQLite storage is never used in production.',
      };
    }
    if ((env.VPARK_DATA_STORE || '').trim().toLowerCase() === 'postgres') {
      return { kind: null, error: 'VPARK_DATA_STORE=postgres is set but DATABASE_URL is not configured.' };
    }
    return { kind: 'json' };
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { kind: null, error: 'DATABASE_URL is not a valid URL.' };
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    return { kind: null, error: 'DATABASE_URL must be a postgres:// or postgresql:// URL.' };
  }

  const sslmode = (parsed.searchParams.get('sslmode') || '').toLowerCase();
  const loopback = isLoopback(parsed.hostname);
  if (production && !loopback && sslmode === 'disable') {
    return { kind: null, error: 'DATABASE_URL disables TLS (sslmode=disable); production requires an encrypted connection.' };
  }
  // In production, connections to a remote database always use TLS with certificate verification.
  const ssl = production && !loopback ? { rejectUnauthorized: true } : undefined;

  const poolMax = Number.parseInt(env.VPARK_DATABASE_POOL_MAX || '', 10);
  return {
    kind: 'postgres',
    connectionString: url,
    ssl,
    poolMax: Number.isInteger(poolMax) && poolMax > 0 && poolMax <= 50 ? poolMax : 5,
  };
}
