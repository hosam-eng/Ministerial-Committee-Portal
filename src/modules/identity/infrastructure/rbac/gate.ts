import { redirect } from "next/navigation";

import { PERMISSIONS, type PermissionKey } from "../../domain/permissions";
import { getAdminAuthState } from "../auth/session";
import { getAuthorizationContext } from "./service";

/**
 * Server-side backoffice gate (IMP-06). Runs the IMP-05 authentication
 * state machine first (unauthenticated → login, pending challenge →
 * /mfa, unenrolled MFA → /mfa/setup — those routes stay RBAC-free),
 * then evaluates RBAC authorization from PostgreSQL on every call.
 *
 * `granted`  — fully authenticated + every required permission
 * `denied`   — fully authenticated but missing a permission → the page
 *              renders the localized access-denied experience
 */
export type BackofficeGate =
  | {
      status: "granted";
      user: { id: string; email: string };
      permissions: ReadonlySet<string>;
    }
  | { status: "denied"; user: { id: string; email: string } };

export async function requireBackoffice(
  locale: string,
  required?: PermissionKey,
): Promise<BackofficeGate> {
  const state = await getAdminAuthState();
  if (state.status === "unauthenticated") {
    redirect(`/${locale}/admin/login`);
  }
  if (state.status === "mfa-challenge-pending") {
    redirect(`/${locale}/admin/mfa`);
  }
  if (state.status === "mfa-enrollment-required") {
    redirect(`/${locale}/admin/mfa/setup`);
  }
  const { permissions } = await getAuthorizationContext(state.user.id);
  const needed = required
    ? [PERMISSIONS.BACKOFFICE_ACCESS, required]
    : [PERMISSIONS.BACKOFFICE_ACCESS];
  if (!needed.every((key) => permissions.has(key))) {
    return { status: "denied", user: state.user };
  }
  return { status: "granted", user: state.user, permissions };
}
