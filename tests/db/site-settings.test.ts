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
  approveSiteSettings,
  getEditorialSiteSettings,
  publishSiteSettings,
  resolveLivePublicSiteSettings,
  saveSiteSettingsDraft,
  startEditingSiteSettings,
  submitSiteSettings,
  unpublishSiteSettings,
} from "@/modules/site-settings";
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

const draft = {
  contactEmail: "info@example.com",
  contactPhone: "+966500000000",
  translations: {
    ar: {
      officialName: "اللجنة",
      address: "الرياض",
      defaultSeoTitle: "عنوان",
      defaultSeoDescription: "وصف",
    },
    en: {
      officialName: "Committee",
      address: "Riyadh",
      defaultSeoTitle: "Title",
      defaultSeoDescription: "Description",
    },
  },
  socialLinks: [
    {
      itemKey: "33333333-3333-4333-8333-333333333333",
      labelAr: "موقع",
      labelEn: "Site",
      url: "https://example.com",
      position: 0,
    },
  ],
};

beforeAll(async () => {
  container = await new PostgreSqlContainer(IMAGE)
    .withDatabase("mcp_site_settings")
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
      { email: "site-settings-admin@example.test", passwordHash: "hash" },
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

describe("site settings persistence", () => {
  it("enforces singleton and live-only public reads", async () => {
    const roots = await db().prisma.siteSettings.findMany();
    expect(roots).toHaveLength(1);
    expect(await resolveLivePublicSiteSettings("en", db())).toBeNull();

    const editorial = await getEditorialSiteSettings(adminId, db());
    expect(editorial.active).toBeTruthy();
    const version = editorial.active!.editVersion;
    await saveSiteSettingsDraft(adminId, version, draft, db());
    await submitSiteSettings(adminId, version + 1, db());
    const pending = await getEditorialSiteSettings(adminId, db());
    await db().prisma.siteSettingsRevision.update({
      where: { id: pending.active!.id },
      data: { submittedById: "00000000-0000-4000-8000-000000000099" },
    });
    await approveSiteSettings(adminId, db());
    await publishSiteSettings(adminId, db());

    const live = await resolveLivePublicSiteSettings("en", db());
    expect(live?.officialName).toBe("Committee");
    expect(live?.socialLinks[0]?.href).toBe("https://example.com");

    await unpublishSiteSettings(adminId, "maintenance", db());
    expect(await resolveLivePublicSiteSettings("en", db())).toBeNull();
  });

  it("detects stale concurrent saves", async () => {
    await startEditingSiteSettings(adminId, db());
    const editorial = await getEditorialSiteSettings(adminId, db());
    const version = editorial.active!.editVersion;
    await saveSiteSettingsDraft(adminId, version, draft, db());
    await expect(
      saveSiteSettingsDraft(adminId, version, draft, db()),
    ).rejects.toMatchObject({ code: "CONCURRENT_MODIFICATION" });
  });
});
