import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { requireActorPermission } from "@/modules/identity";
import {
  AccessDeniedError,
  BootstrapClosedError,
  LastAdministratorError,
  RoleValidationError,
  SystemRoleError,
} from "@/modules/identity/application/authorization";
import {
  ADMINISTRATOR_SYSTEM_KEY,
  PERMISSIONS,
  PERMISSION_KEYS,
} from "@/modules/identity/domain/permissions";
import {
  createAuth,
  type Auth,
} from "@/modules/identity/infrastructure/auth/auth";
import * as service from "@/modules/identity/infrastructure/rbac/service";
import { createNewsDraft } from "@/modules/publishing";
import { resetServerConfigForTest } from "@/platform/config";
import { createDatabase, type Database } from "@/platform/database";
import { closeRuntimeDatabase } from "@/platform/runtime";

/**
 * IMP-06 RBAC persistence + authorization suite — a real ephemeral
 * PostgreSQL 18 with the repository role bootstrap. Everything runs on
 * the mcp_runtime connection, proving least-privilege DML is enough.
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
let runtimeDatabase: Database;
let auth: Auth;
let counter = 0;
let previousDatabaseUrl: string | undefined;

function uriFor(user: string, password: string): string {
  const url = new URL(container.getConnectionUri());
  url.username = user;
  url.password = password;
  return url.toString();
}

const db = () => runtimeDatabase;

/** Create a bare user row (credential-less is fine for RBAC tests). */
async function makeUser(): Promise<{ id: string; email: string }> {
  counter += 1;
  const email = `rbac-user-${counter}@example.test`;
  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser(
    { email, name: email, emailVerified: true },
    { method: "email-password" },
  );
  return { id: user.id, email };
}

async function permissionId(key: string): Promise<string> {
  const row = await runtimeDatabase.prisma.permission.findUniqueOrThrow({
    where: { key },
    select: { id: true },
  });
  return row.id;
}

async function adminRoleId(): Promise<string> {
  const row = await runtimeDatabase.prisma.role.findUniqueOrThrow({
    where: { systemKey: ADMINISTRATOR_SYSTEM_KEY },
    select: { id: true },
  });
  return row.id;
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

  await execFileAsync(process.execPath, [PRISMA_CLI, "migrate", "deploy"], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      DATABASE_MIGRATION_URL: uriFor("mcp_migrate", "mcp_migrate_dev"),
    },
    timeout: 150_000,
  });

  runtimeDatabase = createDatabase({
    connectionString: uriFor("mcp_runtime", "mcp_runtime_dev"),
  });
  auth = createAuth(runtimeDatabase);
  previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = uriFor("mcp_runtime", "mcp_runtime_dev");
  resetServerConfigForTest();
  await closeRuntimeDatabase();
}, CONTAINER_TIMEOUT_MS);

afterAll(async () => {
  await closeRuntimeDatabase();
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  resetServerConfigForTest();
  await runtimeDatabase?.close();
  await container?.stop();
});

describe("RBAC schema + deterministic seed (IMP-06)", () => {
  it("creates the four RBAC tables in the identity schema only", async () => {
    const tables = await runtimeDatabase.prisma.$queryRawUnsafe<
      { name: string }[]
    >(
      `SELECT table_name AS name FROM information_schema.tables
       WHERE table_name IN ('role','permission','role_permission','user_role')`,
    );
    const bySchema = await runtimeDatabase.prisma.$queryRawUnsafe<
      { schema: string }[]
    >(
      `SELECT DISTINCT table_schema AS schema FROM information_schema.tables
       WHERE table_name IN ('role','permission','role_permission','user_role')`,
    );
    expect(tables).toHaveLength(4);
    expect(bySchema).toEqual([{ schema: "identity" }]);
    // No direct User↔Permission relation may exist anywhere.
    const forbidden = await runtimeDatabase.prisma.$queryRawUnsafe<
      { name: string }[]
    >(
      `SELECT table_name AS name FROM information_schema.tables
       WHERE table_name ILIKE '%user%permission%' OR table_name ILIKE '%user_permission%'`,
    );
    expect(forbidden).toEqual([]);
  });

  it("seeds exactly the five system permissions and the Administrator role with all of them", async () => {
    const keys = (
      await runtimeDatabase.prisma.permission.findMany({
        select: { key: true },
      })
    ).map((p) => p.key);
    expect(keys.sort()).toEqual([...PERMISSION_KEYS].sort());

    const admin = await runtimeDatabase.prisma.role.findUniqueOrThrow({
      where: { systemKey: ADMINISTRATOR_SYSTEM_KEY },
      include: { permissions: { include: { permission: true } } },
    });
    expect(admin.isActive).toBe(true);
    expect(admin.permissions.map((rp) => rp.permission.key).sort()).toEqual(
      [...PERMISSION_KEYS].sort(),
    );
  });

  it("generates UUIDv7 identifiers and enforces uniqueness", async () => {
    const role = await runtimeDatabase.prisma.role.findUniqueOrThrow({
      where: { systemKey: ADMINISTRATOR_SYSTEM_KEY },
    });
    // UUIDv7: version nibble 7 at position 14, variant 8-b at 19.
    expect(role.id).toMatch(/^[0-9a-f-]{14}7[0-9a-f]{3}-[89ab][0-9a-f]{3}-/i);

    await expect(
      runtimeDatabase.prisma.permission.create({
        data: { key: PERMISSIONS.BACKOFFICE_ACCESS },
      }),
    ).rejects.toThrow();
    await expect(
      runtimeDatabase.prisma.role.create({
        data: { name: "Administrator" },
      }),
    ).rejects.toThrow();
  });
});

describe("first-administrator bootstrap + last-administrator protection", () => {
  it("bootstrap succeeds with zero administrators and refuses afterwards", async () => {
    const first = await service.bootstrapFirstAdministrator(
      { email: "first-admin@example.test", passwordHash: "argon2id$hash" },
      db(),
    );
    expect(first.createdUser).toBe(true);

    await expect(
      service.bootstrapFirstAdministrator(
        { email: "second-admin@example.test", passwordHash: "x" },
        db(),
      ),
    ).rejects.toBeInstanceOf(BootstrapClosedError);
  });

  it("rejects removal of the final Administrator membership", async () => {
    const adminRole = await adminRoleId();
    const member = await runtimeDatabase.prisma.userRole.findFirstOrThrow({
      where: { roleId: adminRole },
    });
    // The actor is an administrator (has user_roles.manage).
    await expect(
      service.unassignRole(member.userId, member.userId, adminRole, db()),
    ).rejects.toBeInstanceOf(LastAdministratorError);
    // Still exactly one membership.
    expect(
      await runtimeDatabase.prisma.userRole.count({
        where: { roleId: adminRole },
      }),
    ).toBe(1);
  });

  it("allows removing one of two Administrators, then blocks the last", async () => {
    const adminRole = await adminRoleId();
    const admin = (
      await runtimeDatabase.prisma.userRole.findFirstOrThrow({
        where: { roleId: adminRole },
      })
    ).userId;
    const second = await makeUser();
    await service.assignRole(admin, second.id, adminRole, db());

    await service.unassignRole(admin, second.id, adminRole, db());
    await expect(
      service.unassignRole(admin, admin, adminRole, db()),
    ).rejects.toBeInstanceOf(LastAdministratorError);
  });

  it("concurrent removals cannot leave zero Administrators", async () => {
    const adminRole = await adminRoleId();
    const admin = (
      await runtimeDatabase.prisma.userRole.findFirstOrThrow({
        where: { roleId: adminRole },
      })
    ).userId;
    const second = await makeUser();
    await service.assignRole(admin, second.id, adminRole, db());

    const results = await Promise.allSettled([
      service.unassignRole(admin, admin, adminRole, db()),
      service.unassignRole(admin, second.id, adminRole, db()),
    ]);
    expect(
      await runtimeDatabase.prisma.userRole.count({
        where: { roleId: adminRole },
      }),
    ).toBe(1);
    // Exactly one removal won the serialized race.
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
});

describe("authorization evaluation (default deny)", () => {
  async function makeRole(
    actor: string,
    name: string,
    keys: string[],
  ): Promise<string> {
    const role = await service.createCustomRole(
      actor,
      {
        name,
        description: null,
        permissionIds: await Promise.all(keys.map(permissionId)),
      },
      db(),
    );
    return role.id;
  }

  it("no roles → deny; role without permission → deny", async () => {
    const user = await makeUser();
    expect(
      await service.hasPermission(user.id, PERMISSIONS.BACKOFFICE_ACCESS, db()),
    ).toBe(false);

    const admin = (
      await runtimeDatabase.prisma.userRole.findFirstOrThrow({
        where: { role: { systemKey: ADMINISTRATOR_SYSTEM_KEY } },
      })
    ).userId;
    const empty = await makeRole(admin, "Empty Role", []);
    await service.assignRole(admin, user.id, empty, db());
    expect(
      await service.hasPermission(user.id, PERMISSIONS.BACKOFFICE_ACCESS, db()),
    ).toBe(false);
  });

  it("role with permission → allow; read does not imply manage", async () => {
    const admin = (
      await runtimeDatabase.prisma.userRole.findFirstOrThrow({
        where: { role: { systemKey: ADMINISTRATOR_SYSTEM_KEY } },
      })
    ).userId;
    const user = await makeUser();
    const role = await makeRole(admin, "Viewer Role", [
      PERMISSIONS.BACKOFFICE_ACCESS,
      PERMISSIONS.ROLES_READ,
    ]);
    await service.assignRole(admin, user.id, role, db());

    expect(
      await service.hasPermission(user.id, PERMISSIONS.BACKOFFICE_ACCESS, db()),
    ).toBe(true);
    expect(
      await service.hasPermission(user.id, PERMISSIONS.ROLES_READ, db()),
    ).toBe(true);
    // read ≠ manage, and backoffice.access alone grants nothing else.
    expect(
      await service.hasPermission(user.id, PERMISSIONS.ROLES_MANAGE, db()),
    ).toBe(false);
    expect(
      await service.hasPermission(user.id, PERMISSIONS.USERS_READ, db()),
    ).toBe(false);
    await expect(
      service.createCustomRole(
        user.id,
        { name: "Nope", description: null, permissionIds: [] },
        db(),
      ),
    ).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it("multiple roles → union of permissions", async () => {
    const admin = (
      await runtimeDatabase.prisma.userRole.findFirstOrThrow({
        where: { role: { systemKey: ADMINISTRATOR_SYSTEM_KEY } },
      })
    ).userId;
    const user = await makeUser();
    await service.assignRole(
      admin,
      user.id,
      await makeRole(admin, "Union A", [PERMISSIONS.BACKOFFICE_ACCESS]),
      db(),
    );
    await service.assignRole(
      admin,
      user.id,
      await makeRole(admin, "Union B", [PERMISSIONS.USERS_READ]),
      db(),
    );
    const ctx = await service.getAuthorizationContext(user.id, db());
    expect(ctx.permissions.has(PERMISSIONS.BACKOFFICE_ACCESS)).toBe(true);
    expect(ctx.permissions.has(PERMISSIONS.USERS_READ)).toBe(true);
  });

  it("inactive role contributes nothing; changes are effective on the next check", async () => {
    const admin = (
      await runtimeDatabase.prisma.userRole.findFirstOrThrow({
        where: { role: { systemKey: ADMINISTRATOR_SYSTEM_KEY } },
      })
    ).userId;
    const user = await makeUser();
    const roleId = await makeRole(admin, "Toggle Role", [
      PERMISSIONS.BACKOFFICE_ACCESS,
      PERMISSIONS.USERS_READ,
    ]);
    await service.assignRole(admin, user.id, roleId, db());
    expect(
      await service.hasPermission(user.id, PERMISSIONS.USERS_READ, db()),
    ).toBe(true);

    // Role deactivation → effective immediately, no re-login.
    await service.setCustomRoleActive(admin, roleId, false, db());
    expect(
      await service.hasPermission(user.id, PERMISSIONS.USERS_READ, db()),
    ).toBe(false);

    // Permission removal → effective on next evaluation.
    await service.setCustomRoleActive(admin, roleId, true, db());
    await service.setCustomRolePermissions(
      admin,
      roleId,
      [await permissionId(PERMISSIONS.BACKOFFICE_ACCESS)],
      db(),
    );
    expect(
      await service.hasPermission(user.id, PERMISSIONS.USERS_READ, db()),
    ).toBe(false);
    expect(
      await service.hasPermission(user.id, PERMISSIONS.BACKOFFICE_ACCESS, db()),
    ).toBe(true);

    // Removing the assignment restores default deny.
    await service.unassignRole(admin, user.id, roleId, db());
    expect(
      await service.hasPermission(user.id, PERMISSIONS.BACKOFFICE_ACCESS, db()),
    ).toBe(false);
    // Removing a missing assignment is a safe no-op.
    await service.unassignRole(admin, user.id, roleId, db());
  });
});

describe("role mutation authorization + system-role protection", () => {
  it("unauthorized caller cannot mutate roles or assignments", async () => {
    const outsider = await makeUser();
    await expect(
      service.createCustomRole(
        outsider.id,
        { name: "Blocked", description: null, permissionIds: [] },
        db(),
      ),
    ).rejects.toBeInstanceOf(AccessDeniedError);
    const role = await runtimeDatabase.prisma.role.findUniqueOrThrow({
      where: { systemKey: ADMINISTRATOR_SYSTEM_KEY },
    });
    await expect(
      service.assignRole(outsider.id, outsider.id, role.id, db()),
    ).rejects.toBeInstanceOf(AccessDeniedError);
    await expect(
      service.unassignRole(outsider.id, outsider.id, role.id, db()),
    ).rejects.toBeInstanceOf(AccessDeniedError);
    await expect(
      service.listBackofficeUsers(outsider.id, db()),
    ).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it("the Administrator system role rejects every mutation", async () => {
    const admin = (
      await runtimeDatabase.prisma.userRole.findFirstOrThrow({
        where: { role: { systemKey: ADMINISTRATOR_SYSTEM_KEY } },
      })
    ).userId;
    const adminRole = await adminRoleId();
    await expect(
      service.updateCustomRole(
        admin,
        adminRole,
        { name: "Renamed", description: null },
        db(),
      ),
    ).rejects.toBeInstanceOf(SystemRoleError);
    await expect(
      service.setCustomRoleActive(admin, adminRole, false, db()),
    ).rejects.toBeInstanceOf(SystemRoleError);
    await expect(
      service.setCustomRolePermissions(admin, adminRole, [], db()),
    ).rejects.toBeInstanceOf(SystemRoleError);
    // Unchanged.
    const still = await runtimeDatabase.prisma.role.findUniqueOrThrow({
      where: { id: adminRole },
      include: { permissions: true },
    });
    expect(still.name).toBe("Administrator");
    expect(still.isActive).toBe(true);
    expect(still.permissions).toHaveLength(PERMISSION_KEYS.length);
  });

  it("assignment is idempotent and rejects inactive roles", async () => {
    const admin = (
      await runtimeDatabase.prisma.userRole.findFirstOrThrow({
        where: { role: { systemKey: ADMINISTRATOR_SYSTEM_KEY } },
      })
    ).userId;
    const user = await makeUser();
    const role = await service.createCustomRole(
      admin,
      {
        name: "Idempotent Role",
        description: null,
        permissionIds: [await permissionId(PERMISSIONS.BACKOFFICE_ACCESS)],
      },
      db(),
    );
    await service.assignRole(admin, user.id, role.id, db());
    await service.assignRole(admin, user.id, role.id, db()); // no duplicate
    expect(
      await runtimeDatabase.prisma.userRole.count({
        where: { userId: user.id, roleId: role.id },
      }),
    ).toBe(1);

    await service.setCustomRoleActive(admin, role.id, false, db());
    await expect(
      service.assignRole(admin, user.id, role.id, db()),
    ).rejects.toBeInstanceOf(RoleValidationError);
  });

  it("role input is validated (name required/bounded, description bounded)", async () => {
    const admin = (
      await runtimeDatabase.prisma.userRole.findFirstOrThrow({
        where: { role: { systemKey: ADMINISTRATOR_SYSTEM_KEY } },
      })
    ).userId;
    await expect(
      service.createCustomRole(
        admin,
        { name: "   ", description: null, permissionIds: [] },
        db(),
      ),
    ).rejects.toBeInstanceOf(RoleValidationError);
    await expect(
      service.createCustomRole(
        admin,
        {
          name: "x".repeat(81),
          description: null,
          permissionIds: [],
        },
        db(),
      ),
    ).rejects.toBeInstanceOf(RoleValidationError);
    await expect(
      service.createCustomRole(
        admin,
        {
          name: "Dup",
          description: null,
          permissionIds: ["00000000-0000-0000-0000-000000000000"],
        },
        db(),
      ),
    ).rejects.toBeInstanceOf(RoleValidationError);
  });
});

describe("public actor authorization contract (ARCH-1)", () => {
  async function administratorId(): Promise<string> {
    return (
      await runtimeDatabase.prisma.userRole.findFirstOrThrow({
        where: { role: { systemKey: ADMINISTRATOR_SYSTEM_KEY } },
      })
    ).userId;
  }

  it("grants an authorized actor and denies an unauthorized actor", async () => {
    const admin = await administratorId();
    const denied = await makeUser();
    await expect(
      requireActorPermission(denied.id, PERMISSIONS.NEWS_CREATE),
    ).rejects.toBeInstanceOf(AccessDeniedError);

    const allowed = await makeUser();
    const role = await service.createCustomRole(
      admin,
      {
        name: `News Create ${counter}`,
        description: null,
        permissionIds: [await permissionId(PERMISSIONS.NEWS_CREATE)],
      },
      db(),
    );
    await service.assignRole(admin, allowed.id, role.id, db());
    await expect(
      requireActorPermission(allowed.id, PERMISSIONS.NEWS_CREATE),
    ).resolves.toBeUndefined();
  });
});

describe("publishing authorization boundary (ARCH-1)", () => {
  async function administratorId(): Promise<string> {
    return (
      await runtimeDatabase.prisma.userRole.findFirstOrThrow({
        where: { role: { systemKey: ADMINISTRATOR_SYSTEM_KEY } },
      })
    ).userId;
  }

  it("denies an unauthorized News draft before a Publishing row exists", async () => {
    const actor = await makeUser();
    const before = await runtimeDatabase.prisma.news.count();
    await expect(createNewsDraft(actor.id)).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
    expect(await runtimeDatabase.prisma.news.count()).toBe(before);
  });

  it("creates a News draft for an actor who holds publishing.news.create", async () => {
    const admin = await administratorId();
    const actor = await makeUser();
    const role = await service.createCustomRole(
      admin,
      {
        name: `News Author ${counter}`,
        description: null,
        permissionIds: [await permissionId(PERMISSIONS.NEWS_CREATE)],
      },
      db(),
    );
    await service.assignRole(admin, actor.id, role.id, db());
    const created = await createNewsDraft(actor.id);
    const row = await runtimeDatabase.prisma.news.findUnique({
      where: { id: created.newsId },
    });
    expect(row?.createdById).toBe(actor.id);
    expect(created.revisionId).toEqual(expect.any(String));
  });
});
