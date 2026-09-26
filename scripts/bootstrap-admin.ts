/**
 * Production first-administrator bootstrap (IMP-06 §12).
 *
 *   IDENTITY_ADMIN_EMAIL=admin@example.gov \
 *   IDENTITY_ADMIN_PASSWORD='<12+ chars>' npm run identity:bootstrap-admin
 *
 * Operator-only CLI — never an HTTP endpoint. Rules enforced by the
 * identity service at the PostgreSQL boundary (serialized on the
 * Administrator role row):
 *
 * - succeeds only while ZERO Administrator memberships exist; once any
 *   membership exists it refuses — later changes go through the
 *   authorized backoffice
 * - creates the account (only if absent) through the same credential
 *   shape Better Auth uses — Argon2id hash via the production password
 *   path — then assigns the built-in Administrator role
 * - never bypasses MFA: first login still requires TOTP enrollment
 * - public signup stays disabled; nothing is printed beyond identifiers
 */
try {
  process.loadEnvFile();
} catch {
  // .env is optional — vars may come from the deployment environment.
}

const email = process.env.IDENTITY_ADMIN_EMAIL;
const password = process.env.IDENTITY_ADMIN_PASSWORD;

if (!email) {
  console.error(
    "Set IDENTITY_ADMIN_EMAIL. Set IDENTITY_ADMIN_PASSWORD (min 12 chars) only when the account does not exist yet.",
  );
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required (runtime identity).");
  process.exit(1);
}
(process.env as Record<string, string | undefined>).NODE_ENV ??= "development";

const { getAuth, bootstrapFirstAdministrator, BootstrapClosedError } =
  await import("@/modules/identity");

const ctx = await getAuth().$context;
const exists = await ctx.internalAdapter.findUserByEmail(email);

let passwordHash: string | null = null;
if (!exists) {
  if (!password || password.length < 12) {
    console.error(
      "IDENTITY_ADMIN_PASSWORD (min 12 chars) is required to create the account.",
    );
    process.exit(1);
  }
  passwordHash = await ctx.password.hash(password);
}

try {
  const result = await bootstrapFirstAdministrator({
    email,
    passwordHash,
  });
  console.log(
    `Administrator role assigned to ${email} (user ${result.userId}` +
      `${result.createdUser ? ", account created" : ""}). ` +
      "Mandatory TOTP enrollment still applies on first login.",
  );
} catch (error) {
  if (error instanceof BootstrapClosedError) {
    console.error(
      "Refused: an Administrator membership already exists. " +
        "Manage role assignments through the authorized backoffice.",
    );
    process.exit(1);
  }
  throw error;
}
