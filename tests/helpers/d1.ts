/**
 * D1 tiruan untuk tes unit: SQLite di memori (node:sqlite, bawaan Node 24) dengan migrasi dari migrations/*.sql.
 * Hanya bagian API D1 yang dipakai Worker (prepare → bind → run/all).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database, D1PreparedStatement } from '../../worker/env';

export function testD1(): { d1: D1Database; db: DatabaseSync } {
  const db = new DatabaseSync(':memory:');
  for (const file of readdirSync('migrations').filter((f) => f.endsWith('.sql')).sort()) db.exec(readFileSync(`migrations/${file}`, 'utf8'));
  const statement = (sql: string, params: (string | number | null)[] = []): D1PreparedStatement => ({
    bind: (...values) => statement(sql, values),
    run: async () => db.prepare(sql).run(...params),
    all: async <T>() => ({ results: db.prepare(sql).all(...params) as T[] }),
  });
  return { db, d1: { prepare: (sql) => statement(sql) } };
}
