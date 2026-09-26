/**
 * Identity module — public contract.
 *
 * Only the sanctioned surface is exported: the Better Auth instance and
 * its Next.js route handlers (for /api/auth/*), the server-side admin
 * authentication gate, and the localized admin presentation components.
 */
export { getAuth } from "./infrastructure/auth/auth";
export { authRouteHandlers } from "./infrastructure/auth/route-handler";
export {
  getAdminAuthState,
  type AdminAuthState,
} from "./infrastructure/auth/session";
export { AdminPlaceholder } from "./presentation/admin-placeholder";
export { LoginForm } from "./presentation/login-form";
export { MfaChallengeForm } from "./presentation/mfa-challenge-form";
export { MfaSetupForm } from "./presentation/mfa-setup-form";
