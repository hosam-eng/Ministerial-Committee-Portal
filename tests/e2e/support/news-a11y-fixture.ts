import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const ARTIFACT = path.resolve(
  import.meta.dirname,
  "../.cache/a11y-news-fixture.json",
);
const VITEST_CLI = path.join(REPO_ROOT, "node_modules/vitest/vitest.mjs");
const SEED_TEST = path.join(
  REPO_ROOT,
  "tests/db/a11y-news-fixture-seed.test.ts",
);

export const A11Y_NEWS_SLUGS = {
  ar: "a11y-news-live-ar",
  en: "a11y-news-live-en",
} as const;

export type A11yNewsFixture = {
  newsId: string;
  revisionId: string;
};

let cachedFixture: A11yNewsFixture | null = null;

/** Idempotent published News fixture for TB-IMP-05 axe (fixed bilingual slugs). */
export async function ensureA11yNewsFixture(): Promise<A11yNewsFixture> {
  if (cachedFixture) return cachedFixture;
  await execFileAsync(process.execPath, [VITEST_CLI, "run", SEED_TEST], {
    cwd: REPO_ROOT,
    env: process.env,
    timeout: 120_000,
  });
  cachedFixture = JSON.parse(readFileSync(ARTIFACT, "utf8")) as A11yNewsFixture;
  return cachedFixture;
}
