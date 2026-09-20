#!/usr/bin/env node
/**
 * Minimal forward-only migration runner.
 *
 * Every .sql file in /migrations is applied once, in filename order, inside a
 * transaction, and recorded in schema_migrations. A matching *.down.sql file is
 * used by `migrate down`.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, withTransaction } from './pool.js';
import logger from '../utils/logger.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, '../../migrations');

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function listMigrations() {
  const files = await fs.readdir(migrationsDir);
  return files.filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql')).sort();
}

async function applied() {
  const { rows } = await pool.query('SELECT name FROM schema_migrations ORDER BY name');
  return new Set(rows.map((r) => r.name));
}

async function up() {
  await ensureTable();
  const done = await applied();
  const pending = (await listMigrations()).filter((name) => !done.has(name));

  if (!pending.length) {
    logger.info('Database is already up to date.');
    return;
  }

  for (const name of pending) {
    const sql = await fs.readFile(path.join(migrationsDir, name), 'utf8');
    await withTransaction(async (tx) => {
      await tx.query(sql);
      await tx.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
    });
    logger.info(`Applied migration ${name}`);
  }
}

async function down() {
  await ensureTable();
  const { rows } = await pool.query('SELECT name FROM schema_migrations ORDER BY name DESC LIMIT 1');
  const last = rows[0]?.name;
  if (!last) {
    logger.info('Nothing to roll back.');
    return;
  }
  const downFile = last.replace(/\.sql$/, '.down.sql');
  const sql = await fs.readFile(path.join(migrationsDir, downFile), 'utf8');
  await withTransaction(async (tx) => {
    await tx.query(sql);
    await tx.query('DELETE FROM schema_migrations WHERE name = $1', [last]);
  });
  logger.info(`Rolled back ${last}`);
}

async function reset() {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  logger.warn('Public schema dropped and recreated.');
  await up();
}

const command = process.argv[2] ?? 'up';
const commands = { up, down, reset };

try {
  if (!commands[command]) throw new Error(`Unknown command "${command}". Use up | down | reset.`);
  await commands[command]();
  await pool.end();
  process.exit(0);
} catch (error) {
  logger.error('Migration failed', { message: error.message });
  await pool.end();
  process.exit(1);
}
