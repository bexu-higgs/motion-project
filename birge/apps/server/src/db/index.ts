import { mkdirSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { MIGRATIONS } from './migrations';

export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export interface Db extends Queryable {
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  kind: 'postgres' | 'pglite';
}

async function createPostgres(url: string): Promise<Db> {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  return {
    kind: 'postgres',
    async query<T>(sql: string, params: unknown[] = []) {
      const res = await pool.query(sql, params);
      return { rows: res.rows as T[] };
    },
    async transaction<T>(fn: (tx: Queryable) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({
          async query<R>(sql: string, params: unknown[] = []) {
            const res = await client.query(sql, params);
            return { rows: res.rows as R[] };
          },
        });
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}

/**
 * PGlite — WebAssembly-дағы толыққанды Postgres. Postgres орнатпай-ақ
 * серверді бір командамен іске қосуға (және тесттерге) ыңғайлы.
 * `dataDir` берілмесе — дерекқор жадта ғана тұрады.
 */
async function createPglite(dataDir?: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  if (dataDir) mkdirSync(path.dirname(dataDir), { recursive: true });
  const db = dataDir ? await PGlite.create(dataDir) : await PGlite.create();
  // PGlite бір байланыспен жұмыс істейді — транзакциялар бір-бірін күтуі керек.
  let chain: Promise<unknown> = Promise.resolve();
  const serialize = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.then(fn, fn);
    chain = run.catch(() => undefined);
    return run;
  };
  return {
    kind: 'pglite',
    query<T>(sql: string, params: unknown[] = []) {
      return serialize(async () => {
        const res = await db.query<T>(sql, params);
        return { rows: res.rows };
      });
    },
    transaction<T>(fn: (tx: Queryable) => Promise<T>) {
      return serialize(() =>
        db.transaction(async (tx) =>
          fn({
            async query<R>(sql: string, params: unknown[] = []) {
              const res = await tx.query<R>(sql, params);
              return { rows: res.rows };
            },
          }),
        ),
      );
    },
    async close() {
      await chain;
      await db.close();
    },
  };
}

export async function migrate(db: Db): Promise<void> {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const { rows } = await db.query<{ version: number }>('SELECT version FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.version));
  for (const [index, sql] of MIGRATIONS.entries()) {
    const version = index + 1;
    if (applied.has(version)) continue;
    await db.transaction(async (tx) => {
      for (const statement of sql
        .split(/;\s*\n/)
        .map((s) => s.trim())
        .filter(Boolean)) {
        await tx.query(statement);
      }
      await tx.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
    });
  }
}

/** DATABASE_URL болса — Postgres, болмаса — PGlite (`memory` — тек жадта). */
export async function createDb(options: { databaseUrl?: string; dataDir: string }): Promise<Db> {
  let db: Db;
  if (options.databaseUrl === 'memory') db = await createPglite();
  else if (options.databaseUrl) db = await createPostgres(options.databaseUrl);
  else db = await createPglite(path.join(options.dataDir, 'db'));
  await migrate(db);
  return db;
}
