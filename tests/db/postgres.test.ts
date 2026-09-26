import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase, type Database } from "@/platform/database";
import { checkDatabaseReadiness } from "@/platform/runtime";

/**
 * IMP-02 data-platform integration suite.
 *
 * Runs against a real ephemeral PostgreSQL 18 container — never SQLite,
 * mocks, or in-memory substitutes (ADR-003). The same role bootstrap
 * used by compose.dev.yml is applied via docker-entrypoint-initdb.d.
 * Credentials here are disposable test values; nothing is logged.
 */

const IMAGE = "postgres:18.6";
const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const PRISMA_CLI = path.join(REPO_ROOT, "node_modules/prisma/build/index.js");
const BOOTSTRAP_SQL = path.join(REPO_ROOT, "docker/postgres/sql/001-roles.sql");
const BOOTSTRAP_SH = path.join(
  REPO_ROOT,
  "docker/postgres/init/00-bootstrap.sh",
);
const CONTAINER_TIMEOUT_MS = 300_000;

const execFileAsync = promisify(execFile);

let container: StartedPostgreSqlContainer;
let connectionUri: string;
let database: Database;

function uriFor(user: string, password: string): string {
  const url = new URL(connectionUri);
  url.username = user;
  url.password = password;
  return url.toString();
}

async function pgErrorCode(
  client: pg.Client,
  statement: string,
): Promise<string | undefined> {
  try {
    await client.query(statement);
    return undefined;
  } catch (error) {
    return (error as pg.DatabaseError).code;
  }
}

beforeAll(async () => {
  container = await new PostgreSqlContainer(IMAGE)
    .withDatabase("mcp_test")
    .withUsername("postgres")
    .withPassword("postgres_test_only")
    .withEnvironment({ TZ: "UTC" })
    .withCommand([
      "postgres",
      "-c",
      "timezone=Etc/UTC",
      "-c",
      "log_timezone=Etc/UTC",
    ])
    .withCopyFilesToContainer([
      { source: BOOTSTRAP_SQL, target: "/mcp-sql/001-roles.sql" },
      {
        source: BOOTSTRAP_SH,
        target: "/docker-entrypoint-initdb.d/00-bootstrap.sh",
      },
    ])
    .start();

  connectionUri = container.getConnectionUri();
  database = createDatabase({ connectionString: connectionUri });
}, CONTAINER_TIMEOUT_MS);

afterAll(async () => {
  await database?.close();
  await container?.stop();
});

describe("PostgreSQL 18 platform", () => {
  it("runs PostgreSQL major version 18", async () => {
    const rows = await database.prisma.$queryRawUnsafe<
      { version_num: string }[]
    >("SELECT current_setting('server_version_num') AS version_num");
    expect(Number(rows[0].version_num)).toBeGreaterThanOrEqual(180000);
    expect(Number(rows[0].version_num)).toBeLessThan(190000);
  });

  it("is reachable through the @prisma/adapter-pg client", async () => {
    const rows =
      await database.prisma.$queryRawUnsafe<{ ok: number }[]>("SELECT 1 AS ok");
    expect(rows[0].ok).toBe(1);
  });

  it("runs the database in UTC", async () => {
    const rows = await database.prisma.$queryRawUnsafe<{ tz: string }[]>(
      "SELECT current_setting('TimeZone') AS tz",
    );
    expect(rows[0].tz).toMatch(/^utc$|etc\/utc/i);
  });

  it("provides native uuidv7()", async () => {
    const rows = await database.prisma.$queryRawUnsafe<
      { id: string; v: number }[]
    >("SELECT uuidv7() AS id, uuid_extract_version(uuidv7()) AS v");
    expect(rows[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(rows[0].v).toBe(7);
  });

  it("preserves timestamptz instants on round-trip", async () => {
    const instant = new Date("2026-09-26T04:30:00.123Z");
    const rows = await database.prisma.$queryRawUnsafe<{ t: Date }[]>(
      "SELECT $1::timestamptz AS t",
      instant,
    );
    expect(rows[0].t.getTime()).toBe(instant.getTime());
  });

  it("created the migration role with schema-evolution rights only", async () => {
    const roles = await database.prisma.$queryRawUnsafe<
      { rolname: string; rolcanlogin: boolean; rolcreatedb: boolean }[]
    >(
      "SELECT rolname, rolcanlogin, rolcreatedb FROM pg_roles WHERE rolname IN ('mcp_owner','mcp_migrate','mcp_runtime') ORDER BY rolname",
    );
    expect(roles).toEqual([
      { rolname: "mcp_migrate", rolcanlogin: true, rolcreatedb: true },
      { rolname: "mcp_owner", rolcanlogin: false, rolcreatedb: false },
      { rolname: "mcp_runtime", rolcanlogin: true, rolcreatedb: false },
    ]);
  });

  it(
    "authenticates migration tooling with the migration identity",
    { timeout: 180_000 },
    async () => {
      const migrationUrl = uriFor("mcp_migrate", "mcp_migrate_dev");
      const { stdout } = await execFileAsync(
        process.execPath,
        [PRISMA_CLI, "migrate", "deploy"],
        {
          cwd: REPO_ROOT,
          env: { ...process.env, DATABASE_MIGRATION_URL: migrationUrl },
          timeout: 150_000,
        },
      );
      // Either the migration applied now or it was already applied —
      // both prove the migration identity can drive prisma migrate.
      expect(stdout).toMatch(
        /No pending migrations to apply|successfully applied/,
      );
    },
  );

  it("lets the runtime role connect and read", async () => {
    const runtime = new pg.Client({
      connectionString: uriFor("mcp_runtime", "mcp_runtime_dev"),
    });
    await runtime.connect();
    const result = await runtime.query("SELECT 1 AS ok");
    expect(result.rows[0].ok).toBe(1);
    await runtime.end();
  });

  it("denies the runtime role representative DDL", async () => {
    const runtime = new pg.Client({
      connectionString: uriFor("mcp_runtime", "mcp_runtime_dev"),
    });
    await runtime.connect();
    for (const statement of [
      "CREATE TABLE forbidden_table(id int)",
      "CREATE SCHEMA forbidden_schema",
      "ALTER DATABASE mcp_test OWNER TO mcp_runtime",
    ]) {
      expect(await pgErrorCode(runtime, statement)).toBe("42501");
    }
    await runtime.end();
  });

  // IMP-03 — readiness probe against the real runtime identity.
  it("readiness probe reports healthy via the runtime identity", async () => {
    const runtimeDb = createDatabase({
      connectionString: uriFor("mcp_runtime", "mcp_runtime_dev"),
    });
    expect(await checkDatabaseReadiness(runtimeDb)).toBe(true);
    await runtimeDb.close();
  });

  it("readiness probe reports an unreachable database as unavailable", async () => {
    const down = createDatabase({
      connectionString: "postgresql://u:p@127.0.0.1:1/mcp_test",
    });
    expect(await checkDatabaseReadiness(down, 5_000)).toBe(false);
    await down.close();
  });

  it("closes the client and pool cleanly", async () => {
    const handle = createDatabase({ connectionString: connectionUri });
    await handle.prisma.$queryRawUnsafe("SELECT 1");
    await expect(handle.close()).resolves.toBeUndefined();
    expect(handle.pool.ended).toBe(true);
    await expect(handle.close()).resolves.toBeUndefined(); // idempotent
  });
});
