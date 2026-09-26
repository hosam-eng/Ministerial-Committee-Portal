import { createHmac } from "node:crypto";

import type {
  GenericEndpointContext,
  HookEndpointContext,
} from "@better-auth/core";
import { APIError, getSessionFromCtx, isAPIError } from "better-auth/api";

import type { Database } from "@/platform/database";
import { Prisma } from "@/platform/database/generated/client";

/**
 * TOTP replay guard (IMP-05 security correction).
 *
 * Better Auth's TOTP verifier accepts a code while it is inside the
 * ±1-step clock window (~90 s at period 30) — it deliberately returns
 * only a boolean and exposes no matched time-step, so the same code can
 * be replayed across successive challenges. A successfully used TOTP is
 * one-time authentication material, so every `/two-factor/verify-totp`
 * call first claims an HMAC fingerprint of (user, code) with an atomic
 * INSERT; a unique violation means the code was already consumed.
 *
 * The claim is released only when the endpoint fails, so invalid codes
 * never consume state. The fingerprint is derived with the server-only
 * auth secret; the raw TOTP is never persisted or logged.
 */

// Two-factor challenge cookie issued at password sign-in (Better Auth
// twoFactor plugin constant `two_factor`, rendered with the cookie
// prefix by ctx.context.createAuthCookie).
const TWO_FACTOR_COOKIE = "two_factor";

// A code is acceptable for up to (2*window+1) periods = 90 s at the
// plugin defaults (period 30 s, window 1). 150 s covers that window
// with margin; expired markers are cleaned lazily on the next claim.
const REPLAY_MARKER_TTL_MS = 150_000;

// Per-request stash key for the claim fingerprint, so the after-hook
// releases only markers created by the same dispatch.
const CLAIM_KEY = "__mcpTotpReplayClaim";

function fingerprint(secret: string, userId: string, code: string): string {
  return createHmac("sha256", secret)
    .update(`totp-replay:${userId}:${code}`)
    .digest("hex");
}

/**
 * Resolve the account being verified — an authenticated session, or the
 * signed pending two-factor challenge cookie (same resolution path the
 * plugin uses: cookie value → verification identifier → user id).
 */
async function resolveUserId(
  ctx: HookEndpointContext,
): Promise<string | undefined> {
  const session = await getSessionFromCtx(ctx as GenericEndpointContext);
  if (session) return session.user.id;
  const cookie = ctx.context.createAuthCookie(TWO_FACTOR_COOKIE);
  const signed = await ctx.getSignedCookie?.(cookie.name, ctx.context.secret);
  if (!signed) return undefined;
  const verification =
    await ctx.context.internalAdapter.findVerificationValue(signed);
  return verification?.value;
}

/**
 * before-hook: atomically claim the TOTP fingerprint. A unique conflict
 * means this code was already consumed — reject with the same generic
 * verification-failure class as an invalid code (no replay disclosure).
 */
export async function claimTotp(
  ctx: HookEndpointContext,
  database: Database,
): Promise<void> {
  const code = (ctx.body as { code?: unknown } | undefined)?.code;
  if (typeof code !== "string" || code.length === 0) return;
  const userId = await resolveUserId(ctx);
  if (!userId) return; // the endpoint produces its own challenge error

  const claim = fingerprint(ctx.context.secret, userId, code);
  // Drop expired markers first so a stale row can never block a new
  // legitimately-coinciding code.
  await database.prisma.totpReplayGuard.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  try {
    await database.prisma.totpReplayGuard.create({
      data: {
        fingerprint: claim,
        userId,
        expiresAt: new Date(Date.now() + REPLAY_MARKER_TTL_MS),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new APIError("UNAUTHORIZED", { message: "Invalid OTP" });
    }
    throw error;
  }
  (ctx.context as Record<string, unknown>)[CLAIM_KEY] = claim;
}

/**
 * after-hook: release this request's claim when verification failed —
 * only successfully verified TOTP values consume replay state.
 */
export async function releaseFailedTotpClaim(
  ctx: HookEndpointContext,
  database: Database,
): Promise<void> {
  const claim = (ctx.context as Record<string, unknown>)[CLAIM_KEY];
  if (typeof claim !== "string") return;
  if (!isAPIError(ctx.context.returned)) return;
  await database.prisma.totpReplayGuard
    .deleteMany({ where: { fingerprint: claim } })
    .catch(() => {});
}
