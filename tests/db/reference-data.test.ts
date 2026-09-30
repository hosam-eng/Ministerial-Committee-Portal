import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bootstrapFirstAdministrator, PERMISSIONS } from "@/modules/identity";
import {
  ReferenceDataError,
  createGeographicArea,
  createTaxonomy,
  deleteGeographicArea,
} from "@/modules/reference-data";
import {
  createNewsCategory,
  createNewsDraft,
  deleteNewsCategory,
  saveNewsDraft,
  NewsError,
} from "@/modules/publishing";
import { resetServerConfigForTest } from "@/platform/config";
import { createDatabase, type Database } from "@/platform/database";
import { closeRuntimeDatabase } from "@/platform/runtime";

const IMAGE = "postgres:18.6";
const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const PRISMA_CLI = path.join(REPO_ROOT, "node_modules/prisma/build/index.js");
const BOOTSTRAP_SQL = path.join(REPO_ROOT, "docker/postgres/sql/001-roles.sql");
const BOOTSTRAP_SH = path.join(
  REPO_ROOT,
  "docker/postgres/init/00-bootstrap.sh",
);
const execFileAsync = promisify(execFile);

let container: StartedPostgreSqlContainer;
let runtimeDatabase: Database;
let adminId: string;
let previousDatabaseUrl: string | undefined;

function uriFor(user: string, password: string): string {
  const url = new URL(container.getConnectionUri());
  url.username = user;
  url.password = password;
  return url.toString();
}

const db = () => runtimeDatabase;

beforeAll(async () => {
  container = await new PostgreSqlContainer(IMAGE)
    .withDatabase("mcp_refdata")
    .withUsername("postgres")
    .withPassword("postgres_test_only")
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
  previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = uriFor("mcp_runtime", "mcp_runtime_dev");
  resetServerConfigForTest();
  await closeRuntimeDatabase();
  adminId = (
    await bootstrapFirstAdministrator(
      { email: "refdata-admin@example.test", passwordHash: "hash" },
      db(),
    )
  ).userId;
}, 300_000);

afterAll(async () => {
  await closeRuntimeDatabase();
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  resetServerConfigForTest();
  await runtimeDatabase?.close();
  await container?.stop();
});

describe("IMP-14 reference data persistence", () => {
  it("creates a taxonomy and blocks duplicate names", async () => {
    await createTaxonomy(
      adminId,
      "eventCategory",
      { nameAr: "فعالية", nameEn: "Event" },
      db(),
    );
    await expect(
      createTaxonomy(
        adminId,
        "eventCategory",
        { nameAr: "فعالية", nameEn: "Other" },
        db(),
      ),
    ).rejects.toThrow(ReferenceDataError);
  });

  it("blocks deleting geographic areas with children", async () => {
    const parent = await createGeographicArea(
      adminId,
      { nameAr: "منطقة", nameEn: "Region" },
      db(),
    );
    await createGeographicArea(
      adminId,
      { nameAr: "مدينة", nameEn: "City", parentId: parent.id },
      db(),
    );
    await expect(
      deleteGeographicArea(adminId, parent.id, db()),
    ).rejects.toThrow(ReferenceDataError);
  });

  it("blocks deleting news categories referenced by revisions", async () => {
    const category = await createNewsCategory(
      adminId,
      { nameAr: "خبر", nameEn: "News" },
      db(),
    );
    const { newsId, editVersion } = await createNewsDraft(adminId, db());
    await saveNewsDraft(
      adminId,
      newsId,
      editVersion,
      {
        translations: {
          ar: {
            title: "عنوان",
            slug: "slug-ar",
            summary: "ملخص",
            body: { version: 1, type: "plainText", text: "نص" },
          },
          en: {
            title: "Title",
            slug: "slug-en",
            summary: "Summary",
            body: { version: 1, type: "plainText", text: "Body" },
          },
        },
        categoryIds: [category.id],
      },
      db(),
    );
    await expect(
      deleteNewsCategory(adminId, category.id, db()),
    ).rejects.toThrow(NewsError);
  });

  it("seeds IMP-14 permissions for administrator", async () => {
    const row = await runtimeDatabase.prisma.permission.findUnique({
      where: { key: PERMISSIONS.REFERENCE_DATA_READ },
    });
    expect(row?.key).toBe("reference_data.read");
  });
});
