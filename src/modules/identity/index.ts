/**
 * Identity module — public contract.
 *
 * Only the sanctioned surface is exported: the Better Auth instance and
 * its Next.js route handlers (for /api/auth/*), the server-side admin
 * authentication gate, the IMP-06 RBAC authorization contract
 * (permission catalog, evaluation, role/user-role management,
 * first-administrator bootstrap), and the localized admin/access
 * presentation components.
 */
export {
  AccessDeniedError,
  BootstrapClosedError,
  LastAdministratorError,
  RoleValidationError,
  SystemRoleError,
} from "./application/authorization";
export {
  ADMINISTRATOR_SYSTEM_KEY,
  PERMISSIONS,
  PERMISSION_KEYS,
  isPermissionKey,
  type PermissionKey,
} from "./domain/permissions";
export { getAuth } from "./infrastructure/auth/auth";
export { authRouteHandlers } from "./infrastructure/auth/route-handler";
export {
  getAdminAuthState,
  type AdminAuthState,
} from "./infrastructure/auth/session";
export {
  requireBackoffice,
  type BackofficeGate,
} from "./infrastructure/rbac/gate";
export {
  assignRole,
  bootstrapFirstAdministrator,
  createCustomRole,
  getAuthorizationContext,
  hasPermission,
  listAllRoles,
  listBackofficeUsers,
  listCatalogPermissions,
  setCustomRoleActive,
  setCustomRolePermissions,
  unassignRole,
  updateCustomRole,
  type AuthorizationContext,
} from "./infrastructure/rbac/service";
export { AccessDenied } from "./presentation/access-denied";
export { AdminHome } from "./presentation/admin-home";
export { LoginForm } from "./presentation/login-form";
export { MfaChallengeForm } from "./presentation/mfa-challenge-form";
export { MfaSetupForm } from "./presentation/mfa-setup-form";
export {
  RolesAdmin,
  type AccessFormAction,
  type CatalogPermissionView,
  type RoleView,
} from "./presentation/roles-admin";
export { UsersAdmin, type UserAccessView } from "./presentation/users-admin";
