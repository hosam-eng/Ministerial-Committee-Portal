import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import type { DatabaseConfig } from "./config";
import { PrismaClient } from "./generated/client";

/**
 * Owned database handle: one pg pool + one Prisma client on top of the
 * @prisma/adapter-pg driver adapter. No pool/client is created per query.
 */
export interface Database {
  readonly prisma: PrismaClient;
  readonly pool: pg.Pool;
  /** Dispose the Prisma client and drain the pool. Idempotent. */
  close(): Promise<void>;
}

/**
 * Create a database handle. The pool connects lazily on first use, so
 * constructing this at module scope does not open sockets or break builds
 * and tests. Callers own the handle and must `close()` it.
 */
export function createDatabase(config: DatabaseConfig): Database {
  const pool = new pg.Pool({
    connectionString: config.connectionString,
    max: config.maxPoolSize ?? 10,
  });

  // The pool stays owned by this factory; the adapter must not end it.
  const adapter = new PrismaPg(pool, { disposeExternalPool: false });
  const prisma = new PrismaClient({ adapter });

  let closed = false;
  return {
    prisma,
    pool,
    async close() {
      if (closed) return;
      closed = true;
      await prisma.$disconnect();
      await pool.end();
    },
  };
}
