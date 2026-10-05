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
  approveNews,
  createNewsDraft,
  getEditorialNews,
  saveNewsDraft,
  submitNews,
  type NewsDraftInput,
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
    .withDatabase("mcp_news_regression_gate")
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
      { email: "news-gate@example.test", passwordHash: "hash" },
      db(),
    )
  ).userId;
}, 240_000);

afterAll(async () => {
  await runtimeDatabase?.close();
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
  resetServerConfigForTest();
  await container?.stop();
});

describe("Track B News regression gaps", () => {
  it("denies self-approval on submitter", async () => {
    const draft: NewsDraftInput = {
      displayDate: "2024-06-01",
      categoryIds: [],
      translations: {
        ar: {
          title: "عنوان",
          slug: "self-approval-ar",
          summary: "ملخص",
          body: { version: 1, type: "plainText", text: "نص" },
        },
        en: {
          title: "Title",
          slug: "self-approval-en",
          summary: "Summary",
          body: { version: 1, type: "plainText", text: "Body" },
        },
      },
    };
    const { newsId, editVersion } = await createNewsDraft(adminId, db());
    const saved = await saveNewsDraft(
      adminId,
      newsId,
      editVersion,
      draft,
      db(),
    );
    await submitNews(adminId, newsId, saved.editVersion, db());
    const editorial = await getEditorialNews(adminId, newsId, db());
    await db().prisma.newsRevision.update({
      where: { id: editorial!.activeRevision!.id },
      data: { submittedById: adminId },
    });
    await expect(approveNews(adminId, newsId, db())).rejects.toMatchObject({
      code: "SELF_APPROVAL_FORBIDDEN",
    });
  });
});
