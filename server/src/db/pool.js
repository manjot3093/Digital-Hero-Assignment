import pg from 'pg';
import env from '../config/env.js';
import logger from '../utils/logger.js';

// Return DECIMAL/NUMERIC as JS numbers rather than strings for our small values.
pg.types.setTypeParser(1700, (value) => (value === null ? null : Number(value)));
// BIGINT counts from COUNT(*) — safe here, our counts fit comfortably in a double.
pg.types.setTypeParser(20, (value) => (value === null ? null : Number(value)));

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.PG_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (error) => logger.error('Unexpected PostgreSQL pool error', { message: error.message }));

/** Parameterised query — the only way SQL is executed in this codebase. */
export async function query(text, params = []) {
  const startedAt = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - startedAt;
  if (duration > 250) logger.warn('Slow query', { duration, text: text.slice(0, 120) });
  return result;
}

export async function queryOne(text, params = []) {
  const { rows } = await query(text, params);
  return rows[0] ?? null;
}

/**
 * Runs `fn` inside a transaction and hands it a client whose `query` has the
 * same signature as the module-level one, so repositories work unchanged
 * whether or not they are inside a transaction.
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn({
      query: (text, params = []) => client.query(text, params),
      queryOne: async (text, params = []) => (await client.query(text, params)).rows[0] ?? null,
      raw: client,
    });
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function healthCheck() {
  const { rows } = await pool.query('SELECT 1 AS ok');
  return rows[0]?.ok === 1;
}

export async function closePool() {
  await pool.end();
}

/** Default executor used by repositories when no transaction client is passed. */
export const db = { query, queryOne };
export default pool;
