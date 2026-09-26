import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { createOTP } from "@better-auth/utils/otp";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createAuth,
  type Auth,
} from "@/modules/identity/infrastructure/auth/auth";
import { createDatabase, type Database } from "@/platform/database";

/**
 * IMP-05 identity persistence + authentication integration suite.
 *
 * Runs the production auth configuration against a real ephemeral
 * PostgreSQL 18 with the same role bootstrap as compose.dev.yml. The
 * auth instance is bound to the mcp_runtime connection — proving the
 * least-privilege identity supports the full auth journey end to end.
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

const USER_EMAIL = "reviewer@example.test";
const USER_PASSWORD = "local-test-password-1234";

const execFileAsync = promisify(execFile);

let container: StartedPostgreSqlContainer;
let connectionUri: string;
let runtimeDatabase: Database;
let auth: Auth;

function uriFor(user: string, password: string): string {
  const url = new URL(connectionUri);
  url.username = user;
  url.password = password;
  return url.toString();
}

function cookieHeader(responseHeaders: Headers): string {
  return (responseHeaders.getSetCookie() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");
}

async function totpForUser(userId: string): Promise<string> {
  const row = await runtimeDatabase.prisma.twoFactor.findUniqueOrThrow({
    where: { userId },
  });
  const ctx = await auth.$context;
  const { symmetricDecrypt } = await import("better-auth/crypto");
  const secret = await symmetricDecrypt({
    key: ctx.secretConfig,
    data: row.secret,
  });
  return createOTP(secret).totp();
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
  const migrationUrl = uriFor("mcp_migrate", "mcp_migrate_dev");
  await execFileAsync(process.execPath, [PRISMA_CLI, "migrate", "deploy"], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_MIGRATION_URL: migrationUrl },
    timeout: 150_000,
  });

  // Auth runs strictly on the runtime identity — this proves required
  // DML is sufficient end to end.
  runtimeDatabase = createDatabase({
    connectionString: uriFor("mcp_runtime", "mcp_runtime_dev"),
  });
  auth = createAuth(runtimeDatabase);

  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser(
    {
      email: USER_EMAIL,
      name: "Local Reviewer",
      emailVerified: true,
    },
    { method: "email-password" },
  );
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: await ctx.password.hash(USER_PASSWORD),
  });
}, CONTAINER_TIMEOUT_MS);

afterAll(async () => {
  await runtimeDatabase?.close();
  await container?.stop();
});

describe("identity schema (IMP-05)", () => {
  it("creates the identity schema and auth tables via migration", async () => {
    const schemas = await runtimeDatabase.prisma.$queryRawUnsafe<
      { name: string }[]
    >(
      "SELECT schema_name AS name FROM information_schema.schemata WHERE schema_name = 'identity'",
    );
    expect(schemas).toHaveLength(1);

    const tables = await runtimeDatabase.prisma.$queryRawUnsafe<
      { name: string }[]
    >(
      `SELECT table_name AS name FROM information_schema.tables
       WHERE table_schema = 'identity' ORDER BY table_name`,
    );
    expect(tables.map((t) => t.name)).toEqual([
      "account",
      "session",
      "two_factor",
      "user",
      "verification",
    ]);
  });

  it("assigns UUIDv7 entity ids while keeping session tokens opaque", async () => {
    const user = await runtimeDatabase.prisma.user.findUniqueOrThrow({
      where: { email: USER_EMAIL },
    });
    const version = await runtimeDatabase.prisma.$queryRawUnsafe<
      { v: number }[]
    >(`SELECT uuid_extract_version('${user.id}'::uuid) AS v`);
    expect(version[0].v).toBe(7);
  });

  it("denies DDL to the runtime identity inside the identity schema", async () => {
    const runtime = new pg.Client({
      connectionString: uriFor("mcp_runtime", "mcp_runtime_dev"),
    });
    await runtime.connect();
    try {
      await expect(
        runtime.query("CREATE TABLE identity.forbidden(id int)"),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        runtime.query("ALTER TABLE identity.user ADD COLUMN hack int"),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        runtime.query("DROP TABLE identity.user"),
      ).rejects.toMatchObject({ code: "42501" });
    } finally {
      await runtime.end();
    }
  });
});

describe("authentication journey (IMP-05)", () => {
  it("rejects public sign-up server-side", async () => {
    await expect(
      auth.api.signUpEmail({
        body: {
          email: "intruder@example.test",
          password: "intruder-password-1234",
          name: "intruder",
        },
      }),
    ).rejects.toMatchObject({
      status: "BAD_REQUEST",
      body: { code: "EMAIL_PASSWORD_SIGN_UP_DISABLED" },
    });
  });

  it("returns the same generic error for unknown user and bad password", async () => {
    const unknown = await auth.api
      .signInEmail({
        body: { email: "ghost@example.test", password: "irrelevant-1234" },
      })
      .catch((error: unknown) => error);
    const wrongPassword = await auth.api
      .signInEmail({
        body: { email: USER_EMAIL, password: "definitely-wrong-1234" },
      })
      .catch((error: unknown) => error);
    expect(unknown).toMatchObject({ status: "UNAUTHORIZED" });
    expect(wrongPassword).toMatchObject({ status: "UNAUTHORIZED" });
    expect((unknown as { body?: { code?: string } }).body?.code).toBe(
      "INVALID_EMAIL_OR_PASSWORD",
    );
    expect((wrongPassword as { body?: { code?: string } }).body?.code).toBe(
      "INVALID_EMAIL_OR_PASSWORD",
    );
  });

  it(
    "completes the full mandatory-MFA journey on the runtime identity",
    { timeout: 120_000 },
    async () => {
      // 1. First password sign-in → real session, MFA not enrolled.
      const first = await auth.api.signInEmail({
        body: { email: USER_EMAIL, password: USER_PASSWORD },
        returnHeaders: true,
      });
      const sessionCookie = cookieHeader(first.headers);
      expect(sessionCookie).toContain("mcp.session_token=");
      expect(
        (first.response as { twoFactorRedirect?: boolean }).twoFactorRedirect,
      ).toBeUndefined();

      const session = await auth.api.getSession({
        headers: new Headers({ cookie: sessionCookie }),
      });
      expect(session?.user.email).toBe(USER_EMAIL);
      expect(
        (session?.user as { twoFactorEnabled?: boolean }).twoFactorEnabled,
      ).toBe(false);
      // Entity id is UUIDv7; the session row id is not the bearer token.
      expect(
        await runtimeDatabase.prisma.$queryRawUnsafe<{ v: number }[]>(
          `SELECT uuid_extract_version('${session!.session.id}'::uuid) AS v`,
        ),
      ).toEqual([{ v: 7 }]);
      const sessionRow = await runtimeDatabase.prisma.session.findUniqueOrThrow(
        { where: { id: session!.session.id } },
      );
      expect(sessionRow.token).not.toBe(session!.session.id);
      expect(sessionRow.token.length).toBeGreaterThanOrEqual(32);

      // 2. Enrollment requires the password.
      await expect(
        auth.api.enableTwoFactor({
          body: {},
          headers: new Headers({ cookie: sessionCookie }),
        }),
      ).rejects.toThrow();

      const enable = await auth.api.enableTwoFactor({
        body: { password: USER_PASSWORD },
        headers: new Headers({ cookie: sessionCookie }),
      });
      const totpUri = (enable as { totpURI: string }).totpURI;
      const backupCodes = (enable as { backupCodes: string[] }).backupCodes;
      expect(totpUri).toContain("otpauth://totp/");
      expect(backupCodes).toHaveLength(10);

      // 3. Enrollment is not active until the TOTP code verifies.
      const interim = await auth.api.getSession({
        headers: new Headers({ cookie: sessionCookie }),
      });
      expect(
        (interim?.user as { twoFactorEnabled?: boolean }).twoFactorEnabled,
      ).toBe(false);

      const code = await totpForUser(session!.user.id);
      const verified = await auth.api.verifyTOTP({
        body: { code },
        headers: new Headers({ cookie: sessionCookie }),
        returnHeaders: true,
      });
      const verifiedCookie = cookieHeader(verified.headers);
      expect(verifiedCookie).toContain("mcp.session_token=");

      // 4. Logout revokes the session.
      await auth.api.signOut({
        headers: new Headers({ cookie: verifiedCookie }),
      });
      const afterLogout = await auth.api.getSession({
        headers: new Headers({ cookie: verifiedCookie }),
      });
      expect(afterLogout).toBeNull();
      await expect(
        runtimeDatabase.prisma.session.findUniqueOrThrow({
          where: { id: session!.session.id },
        }),
      ).rejects.toThrow();

      // 5. Password alone no longer completes login — MFA challenge.
      const second = await auth.api.signInEmail({
        body: { email: USER_EMAIL, password: USER_PASSWORD },
        returnHeaders: true,
      });
      expect(
        (second.response as { twoFactorRedirect?: boolean }).twoFactorRedirect,
      ).toBe(true);
      const pendingCookie = cookieHeader(second.headers);
      expect(pendingCookie).toContain("mcp.two_factor=");
      // The session cookie is explicitly expired (empty value), and the
      // pending challenge alone never authenticates.
      expect(pendingCookie).toMatch(/mcp\.session_token=(;|$)/);
      expect(
        await auth.api.getSession({
          headers: new Headers({ cookie: pendingCookie }),
        }),
      ).toBeNull();

      // 6. Invalid TOTP fails safely.
      await expect(
        auth.api.verifyTOTP({
          body: { code: "000000" },
          headers: new Headers({ cookie: pendingCookie }),
        }),
      ).rejects.toMatchObject({ status: "UNAUTHORIZED" });

      // 7. trustDevice cannot create a bypass.
      await expect(
        auth.api.verifyTOTP({
          body: {
            code: await totpForUser(session!.user.id),
            trustDevice: true,
          },
          headers: new Headers({ cookie: pendingCookie }),
        }),
      ).rejects.toMatchObject({ status: "BAD_REQUEST" });

      // 8. MFA disable is blocked (mandatory MFA).
      await expect(
        auth.api.disableTwoFactor({
          body: { password: USER_PASSWORD },
          headers: new Headers({ cookie: pendingCookie }),
        }),
      ).rejects.toMatchObject({ status: "FORBIDDEN" });

      // 9. Backup code completes authentication and is single-use.
      const challenge2 = await auth.api.signInEmail({
        body: { email: USER_EMAIL, password: USER_PASSWORD },
        returnHeaders: true,
      });
      const pending2 = cookieHeader(challenge2.headers);
      const backup = await auth.api.verifyBackupCode({
        body: { code: backupCodes[0] },
        headers: new Headers({ cookie: pending2 }),
        returnHeaders: true,
      });
      expect(cookieHeader(backup.headers)).toContain("mcp.session_token=");
      const finalSession = await auth.api.getSession({
        headers: new Headers({ cookie: cookieHeader(backup.headers) }),
      });
      expect(finalSession?.user.email).toBe(USER_EMAIL);

      const challenge3 = await auth.api.signInEmail({
        body: { email: USER_EMAIL, password: USER_PASSWORD },
        returnHeaders: true,
      });
      await expect(
        auth.api.verifyBackupCode({
          body: { code: backupCodes[0] },
          headers: new Headers({
            cookie: cookieHeader(challenge3.headers),
          }),
        }),
      ).rejects.toThrow();

      // 10. A fresh valid TOTP still completes the challenge.
      const challenge4 = await auth.api.signInEmail({
        body: { email: USER_EMAIL, password: USER_PASSWORD },
        returnHeaders: true,
      });
      const ok = await auth.api.verifyTOTP({
        body: { code: await totpForUser(session!.user.id) },
        headers: new Headers({ cookie: cookieHeader(challenge4.headers) }),
        returnHeaders: true,
      });
      expect(cookieHeader(ok.headers)).toContain("mcp.session_token=");
    },
  );
});
