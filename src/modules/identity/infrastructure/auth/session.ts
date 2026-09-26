import { cookies, headers } from "next/headers";

import { getAuth } from "./auth";

/**
 * Server-side authentication state for backoffice routes.
 *
 * Four states only — authentication and mandatory-MFA completion are
 * decided here, never in client components:
 * - unauthenticated: no session, no pending MFA challenge
 * - mfa-challenge-pending: password verified, TOTP/backup-code challenge
 *   outstanding (Better Auth's signed `two_factor` pending cookie)
 * - mfa-enrollment-required: valid session but TOTP not yet enrolled —
 *   mandatory for every account, so only the setup page is allowed
 * - authenticated: valid session + MFA enrolled (Better Auth withholds
 *   the session cookie until the challenge succeeds, so a session for an
 *   enrolled user implies full authentication)
 */
export type AdminAuthState =
  | { status: "unauthenticated" }
  | { status: "mfa-challenge-pending" }
  | { status: "mfa-enrollment-required"; email: string }
  | { status: "authenticated"; user: { id: string; email: string } };

export const PENDING_MFA_COOKIE = "mcp.two_factor";

export async function getAdminAuthState(): Promise<AdminAuthState> {
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) {
    const jar = await cookies();
    if (jar.has(PENDING_MFA_COOKIE)) {
      return { status: "mfa-challenge-pending" };
    }
    return { status: "unauthenticated" };
  }
  const user = session.user as {
    id: string;
    email: string;
    twoFactorEnabled?: boolean;
  };
  if (!user.twoFactorEnabled) {
    return { status: "mfa-enrollment-required", email: user.email };
  }
  return {
    status: "authenticated",
    user: { id: user.id, email: user.email },
  };
}
