import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import type { HookEndpointContext } from "@better-auth/core";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { twoFactor } from "better-auth/plugins";

import { getServerConfig } from "@/platform/config";
import type { Database } from "@/platform/database";
import { getRuntimeDatabase } from "@/platform/runtime";

import { hashPassword, verifyPassword } from "./password";
import { claimTotp, releaseFailedTotpClaim } from "./totp-replay";

const VERIFY_TOTP_PATH = "/two-factor/verify-totp";

/**
 * Every endpoint under /two-factor/* that accepts a `trustDevice` flag would
 * issue a signed bypass cookie honored by sign-in. Mandatory MFA cannot
 * allow that path — reject before the endpoint runs.
 */
async function enforceMandatoryMfa(ctx: HookEndpointContext): Promise<void> {
  if (ctx.path === "/two-factor/disable") {
    throw new APIError("FORBIDDEN", {
      message: "Two-factor authentication is mandatory and cannot be disabled.",
    });
  }
  const body = ctx.body as Record<string, unknown> | undefined;
  if (body?.trustDevice === true) {
    throw new APIError("BAD_REQUEST", {
      message: "Trusted-device sessions are not supported.",
    });
  }
}

/**
 * Better Auth server configuration — the single identity authority.
 *
 * Non-negotiable properties (B1 baseline):
 * - public signup disabled server-side (`disableSignUp`)
 * - Argon2id hashing via @node-rs/argon2
 * - database-backed opaque session tokens (no JWT, no cookie cache)
 * - mandatory TOTP for every backoffice account — disable is blocked
 * - trusted-device bypass blocked at the verification boundary
 * - entity IDs come from PostgreSQL `uuidv7()` (generateId: false)
 *
 * Exposed as a factory so integration tests exercise the identical
 * configuration against a disposable database.
 */
export function createAuth(database: Database) {
  const config = getServerConfig();
  return betterAuth({
    appName: "Ministerial Committee Portal",
    secret: config.auth.secret,
    baseURL: config.auth.baseUrl,
    database: prismaAdapter(database.prisma, {
      provider: "postgresql",
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      password: {
        hash: hashPassword,
        verify: verifyPassword,
      },
    },
    // Fixed 8-hour backoffice session — active use must not extend it,
    // so the sliding expiry refresh is disabled entirely.
    session: {
      expiresIn: 60 * 60 * 8,
      disableSessionRefresh: true,
    },
    advanced: {
      cookiePrefix: "mcp",
      database: { generateId: false },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        await enforceMandatoryMfa(ctx);
        // TOTP replay guard: atomically consume the submitted code's
        // fingerprint before verification runs — a conflict rejects the
        // request without ever reaching the session-creating path.
        if (ctx.path === VERIFY_TOTP_PATH) await claimTotp(ctx, database);
      }),
      after: createAuthMiddleware(async (ctx) => {
        // Release this request's claim only when verification failed —
        // successfully verified codes stay consumed.
        if (ctx.path === VERIFY_TOTP_PATH)
          await releaseFailedTotpClaim(ctx, database);
      }),
    },
    plugins: [
      twoFactor({
        issuer: "Ministerial Committee Portal",
        backupCodeOptions: {
          amount: 10,
          length: 10,
        },
        accountLockout: {
          enabled: true,
          maxFailedAttempts: 5,
          durationSeconds: 15 * 60,
        },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

let singleton: Auth | undefined;

/**
 * Process-wide auth instance bound to the runtime database handle.
 * Lazy so importing this module never opens connections or requires
 * DATABASE_URL at module scope (tests create their own instance).
 */
export function getAuth(): Auth {
  singleton ??= createAuth(getRuntimeDatabase());
  return singleton;
}
