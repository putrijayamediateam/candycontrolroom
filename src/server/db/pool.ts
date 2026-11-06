import pg from 'pg';

// Keep SQL `date` values (Malaysia business dates) as plain 'YYYY-MM-DD' strings.
// Otherwise pg turns them into local-midnight Dates, which show as the previous day in UTC exports.
pg.types.setTypeParser(1082, (v) => v);

export type Db = pg.Pool;
export type Tx = pg.PoolClient;

export function createPool(url = process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5433/candy?host=/tmp'): Db {
  return new pg.Pool({ connectionString: url, max: 10 });
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
