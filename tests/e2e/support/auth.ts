import { createOTP } from "@better-auth/utils/otp";
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
 * Login/MFA form validation errors (`role="alert"`). Scoped to `form.auth-form`
 * so Next.js route announcer alerts are excluded.
 */
export function getAuthFormAlert(page: Page) {
  return page.locator("form.auth-form").getByRole("alert");
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

/** Fully authenticated user with ZERO roles — exercises access denied. */
export const A11Y_DENIED_USER = {
  email: "e2e.a11y.denied@example.test",
  name: "E2E A11y Denied",
  password: "e2e-a11y-denied-1234",
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

/**
 * Delete + recreate the fixture user so runs are idempotent. By default
 * the user also receives the built-in Administrator membership — the
 * backoffice requires `backoffice.access`, which only roles can grant.
 * Pass `{ admin: false }` for zero-role authorization fixtures.
 */
export async function seedE2eUser(
  user: { email: string; name: string; password: string } = E2E_USER,
  options: { admin?: boolean } = {},
): Promise<void> {
  const { admin = true } = options;
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
    if (admin) {
      await client.query(
        `INSERT INTO identity.user_role (user_id, role_id)
         SELECT $1, id FROM identity."role" WHERE system_key = 'administrator'`,
        [userId],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Remove every custom (non-system) role so RBAC specs are idempotent —
 * cascades clear role_permission and user_role rows, system roles are
 * untouched.
 */
export async function resetCustomRoles(): Promise<void> {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    await client.query('DELETE FROM identity."role" WHERE system_key IS NULL');
  } finally {
    await client.end();
  }
}

/**
 * The enrollment URI carries a base32-encoded secret while
 * `createOTP`/`verify` operate on the raw secret string — decode back
 * to raw bytes before generating codes. Minimal RFC 4648 decoder
 * (unpadded, as emitted by the enrollment URI).
 */
export function decodeTotpSecret(encoded: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = encoded
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, "")
    .split("")
    .map((c) => alphabet.indexOf(c).toString(2).padStart(5, "0"))
    .join("");
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return String.fromCharCode(...bytes);
}

/**
 * Drive the mandatory MFA enrollment flow after password sign-in:
 * password gate → enrollment URI → first TOTP verification. Returns the
 * raw TOTP secret so callers can mint further codes. Rate-limit
 * tolerant via the shared submit helpers.
 */
export async function completeMfaEnrollment(
  page: Page,
  labels: {
    password: string;
    continue: string;
    code: string;
    submit: string;
  },
  password: string,
): Promise<string> {
  await submitMfaEnable(
    page,
    { password: labels.password, submit: labels.continue },
    password,
  );
  const uri = await page.locator(".auth-secret").innerText();
  const encodedSecret = new URL(uri).searchParams.get("secret");
  if (!encodedSecret) throw new Error("enrollment URI missing secret");
  const secret = decodeTotpSecret(encodedSecret);
  const code = await createOTP(secret).totp();
  await submitMfaVerify(
    page,
    { code: labels.code, submit: labels.submit },
    code,
  );
  return secret;
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

/**
 * Submit an MFA verification (TOTP or backup code) tolerating Better
 * Auth's built-in `/two-factor/*` rule (3 requests / rolling 10 s,
 * shared across parallel workers). The rate limiter runs before the
 * endpoint pipeline, so a 429 never reached verification — the replay
 * guard has not consumed the code and resubmitting it is legitimate.
 */
export async function submitMfaVerify(
  page: Page,
  labels: { code: string; submit: string },
  code: string,
): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.getByLabel(labels.code).fill(code);
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes("/api/auth/two-factor/") &&
          res.request().method() === "POST",
      ),
      page.getByRole("button", { name: labels.submit }).click(),
    ]);
    if (response.status() !== 429) return;
    const retryAfter = Number(response.headers()["x-retry-after"] ?? "10");
    await page.waitForTimeout((retryAfter + 1) * 1000);
  }
  throw new Error("mfa verification remained rate-limited after retries");
}

/** Same 429 tolerance for the `/two-factor/enable` password gate. */
export async function submitMfaEnable(
  page: Page,
  labels: { password: string; submit: string },
  password: string,
): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.getByLabel(labels.password).fill(password);
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes("/api/auth/two-factor/enable") &&
          res.request().method() === "POST",
      ),
      page.getByRole("button", { name: labels.submit }).click(),
    ]);
    if (response.status() !== 429) return;
    const retryAfter = Number(response.headers()["x-retry-after"] ?? "10");
    await page.waitForTimeout((retryAfter + 1) * 1000);
  }
  throw new Error("mfa enable remained rate-limited after retries");
}
