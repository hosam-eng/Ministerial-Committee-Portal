import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bootstrapFirstAdministrator } from "@/modules/identity";
import {
  approveHomepage,
  getEditorialHomepage,
  publishHomepage,
  resolveLivePublicHomepage,
  saveHomepageDraft,
  submitHomepage,
  unpublishHomepage,
  emptyHomepageDraft,
} from "@/modules/homepage";
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

function publishableDraft() {
  const draft = emptyHomepageDraft();
  draft.sections[0]!.hero!.translations.ar.title = "مرحباً";
  draft.sections[0]!.hero!.translations.en.title = "Welcome";
  draft.sections[1]!.news!.translations.ar.sectionHeading = "أخبار";
  draft.sections[1]!.news!.translations.en.sectionHeading = "News";
  return draft;
}

beforeAll(async () => {
  container = await new PostgreSqlContainer(IMAGE)
    .withDatabase("mcp_homepage")
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
      { email: "homepage-admin@example.test", passwordHash: "hash" },
      db(),
    )
  ).userId;
}, 180_000);

afterAll(async () => {
  await runtimeDatabase?.close();
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  resetServerConfigForTest();
  await closeRuntimeDatabase();
  await container?.stop();
});

describe("homepage persistence", () => {
  it("publishes and unpublishes the singleton live revision", async () => {
    const roots = await db().prisma.homepage.findMany();
    expect(roots).toHaveLength(1);
    expect(await resolveLivePublicHomepage("en", db())).toBeNull();

    const editorial = await getEditorialHomepage(adminId, db());
    expect(editorial.active).toBeTruthy();
    const version = editorial.active!.editVersion;
    await saveHomepageDraft(adminId, version, publishableDraft(), db());
    await submitHomepage(adminId, version + 1, db());
    const pending = await getEditorialHomepage(adminId, db());
    await db().prisma.homepageRevision.update({
      where: { id: pending.active!.id },
      data: { submittedById: "00000000-0000-4000-8000-000000000099" },
    });
    await approveHomepage(adminId, db());
    await publishHomepage(adminId, db());

    const live = await resolveLivePublicHomepage("en", db());
    expect(live?.sections.some((section) => section.type === "hero")).toBe(
      true,
    );

    await unpublishHomepage(adminId, "maintenance", db());
    expect(await resolveLivePublicHomepage("en", db())).toBeNull();
  });
});
