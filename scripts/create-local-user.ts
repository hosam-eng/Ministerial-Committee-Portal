/**
 * Development-only local user bootstrap (IMP-05).
 *
 *   APP_ENV=development LOCAL_ADMIN_EMAIL=admin@example.local \
 *     LOCAL_ADMIN_PASSWORD='<12+ chars>' npm run auth:create-local-user
 *
 * - Hard-fails unless APP_ENV=development — never usable in production.
 * - Public signup stays disabled; this uses the server-side internal
 *   adapter (the same seam Better Auth itself uses), so the credential
 *   is hashed by the production Argon2id path and stored exactly as a
 *   sign-up would store it.
 * - No roles, permissions, or RBAC data are created — IMP-06 owns that.
 * - Credentials come from operator-supplied env vars; nothing is
 *   hard-coded and nothing is committed.
 */
try {
  process.loadEnvFile();
} catch {
  // .env is optional — vars may come from the shell environment.
}

if (process.env.APP_ENV !== "development") {
  console.error(
    "create-local-user is development-only: set APP_ENV=development.",
  );
  process.exit(1);
}

const email = process.env.LOCAL_ADMIN_EMAIL;
const password = process.env.LOCAL_ADMIN_PASSWORD;

if (!email || !password) {
  console.error(
    "Set LOCAL_ADMIN_EMAIL and LOCAL_ADMIN_PASSWORD (min 12 chars).",
  );
  process.exit(1);
}
if (password.length < 12) {
  console.error("LOCAL_ADMIN_PASSWORD must be at least 12 characters.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required (runtime identity).");
  process.exit(1);
}
(process.env as Record<string, string | undefined>).NODE_ENV ??= "development";

const { getAuth } = await import("@/modules/identity");

const ctx = await getAuth().$context;
const existing = await ctx.internalAdapter.findUserByEmail(email);
if (existing) {
  console.error(`User already exists for ${email}.`);
  process.exit(1);
}

const user = await ctx.internalAdapter.createUser(
  {
    email,
    name: email,
    emailVerified: true,
  },
  { method: "email-password" },
);

await ctx.internalAdapter.linkAccount({
  userId: user.id,
  providerId: "credential",
  accountId: user.id,
  password: await ctx.password.hash(password),
});

console.log(
  `Created local user ${user.email} (id ${user.id}). ` +
    "MFA/TOTP enrollment is enforced on first login.",
);
