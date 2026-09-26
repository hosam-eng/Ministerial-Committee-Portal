import type { Page } from "@playwright/test";
import pg from "pg";

import { hashPassword } from "../../../src/modules/identity/infrastructure/auth/password";

// Load .env for local runs (gitignored); CI supplies vars directly.
try {
  process.loadEnvFile();
} catch {
  // No .env — expected in CI/production.
}

/** True when the e2e environment points at a real database. */
export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * E2E auth fixtures. Seeds one disposable credential user through plain
 * SQL on the runtime identity — equivalent to what Better Auth's
 * internal adapter persists (user + credential account), hashed via the
 * production Argon2id path. Public signup stays disabled.
 */
export const E2E_USER = {
  email: "e2e.admin@example.test",
  name: "E2E Admin",
  password: "e2e-local-password-1234",
} as const;

/** Separate fixture for the a11y spec — parallel workers must not share
 * mutable MFA state. */
export const A11Y_USER = {
  email: "e2e.a11y@example.test",
  name: "E2E A11y Admin",
  password: "e2e-a11y-password-1234",
} as const;

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required for auth E2E (runtime identity).",
    );
  }
  return url;
}

/** Delete + recreate the fixture user so runs are idempotent. */
export async function seedE2eUser(
  user: { email: string; name: string; password: string } = E2E_USER,
): Promise<void> {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    // Parallel workers each reseed their fixture — serialize the writes.
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(50505)");
    await client.query('DELETE FROM identity."user" WHERE email = $1', [
      user.email,
    ]);
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO identity."user" (email, name, email_verified)
       VALUES ($1, $2, true) RETURNING id`,
      [user.email, user.name],
    );
    const userId = rows[0].id;
    await client.query(
      `INSERT INTO identity.account (account_id, provider_id, user_id, password)
       VALUES ($1, 'credential', $2, $3)`,
      [userId, userId, await hashPassword(user.password)],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Production sign-in is deliberately rate-limited (`/sign-in/*`: 3
 * requests per rolling 10s window — Better Auth's built-in rule, kept
 * enabled). A full auth journey plus parallel workers can exceed that
 * budget; instead of weakening the protection, resubmit after the
 * server-provided retry window.
 */
export async function submitSignIn(
  page: Page,
  labels: { email: string; password: string; submit: string },
  credentials: { email: string; password: string },
): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.getByLabel(labels.email).fill(credentials.email);
    await page.getByLabel(labels.password).fill(credentials.password);
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes("/api/auth/sign-in/email") &&
          res.request().method() === "POST",
      ),
      page.getByRole("button", { name: labels.submit }).click(),
    ]);
    if (response.status() !== 429) return;
    const retryAfter = Number(response.headers()["x-retry-after"] ?? "10");
    await page.waitForTimeout((retryAfter + 1) * 1000);
  }
  throw new Error("sign-in remained rate-limited after retries");
}
