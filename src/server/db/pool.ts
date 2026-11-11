import pg from 'pg';

// Keep SQL `date` values (Malaysia business dates) as plain 'YYYY-MM-DD' strings.
// Otherwise pg turns them into local-midnight Dates, which show as the previous day in UTC exports.
pg.types.setTypeParser(1082, (v) => v);

export type Db = pg.Pool;
export type Tx = pg.PoolClient;

export function createPool(url = process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5433/candy?host=/tmp'): Db {
  return new pg.Pool({ ...poolConfig(url, process.env), max: 10 });
}

/**
 * Connection settings with optional TLS for a hosted database.
 * The mode comes from PGSSLMODE, or from `?sslmode=` in DATABASE_URL:
 * - disable (default for local Postgres): no TLS
 * - require / no-verify: TLS, without checking the server certificate (like libpq "require")
 * - verify-ca / verify-full: TLS with certificate checks; PGSSLROOTCERT_PEM may hold the provider's CA (PEM text)
 */
export function poolConfig(url: string, env: Record<string, string | undefined> = {}): pg.PoolConfig {
  let mode = env.PGSSLMODE?.trim().toLowerCase();
  let connectionString = url;
  try {
    const u = new URL(url);
    const fromUrl = u.searchParams.get('sslmode');
    if (fromUrl) {
      mode ??= fromUrl.toLowerCase();
      u.searchParams.delete('sslmode'); // we pass `ssl` ourselves so pg does not reinterpret it
      connectionString = u.toString();
    }
  } catch { /* not a URL (e.g. a socket path); leave as is */ }
  if (!mode || mode === 'disable' || mode === 'allow' || mode === 'prefer') return { connectionString };
  if (mode === 'require' || mode === 'no-verify') return { connectionString, ssl: { rejectUnauthorized: false } };
  if (mode === 'verify-ca' || mode === 'verify-full') {
    return { connectionString, ssl: { rejectUnauthorized: true, ...(env.PGSSLROOTCERT_PEM ? { ca: env.PGSSLROOTCERT_PEM } : {}) } };
  }
  throw new Error(`Unknown PGSSLMODE "${mode}" (use disable, require, verify-ca or verify-full)`);
}

/** Run fn inside a transaction; rolls back on error. */
export async function tx<T>(db: Db, fn: (c: Tx) => Promise<T>): Promise<T> {
  const c = await db.connect();
  try {
    await c.query('BEGIN');
    const out = await fn(c);
    await c.query('COMMIT');
    return out;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
