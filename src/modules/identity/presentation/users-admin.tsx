import { useTranslations } from "next-intl";

import type { AccessFormAction, RoleView } from "./roles-admin";

export interface UserAccessView {
  readonly id: string;
  readonly email: string;
  readonly roles: readonly RoleView[];
}

/**
 * User ↔ Role assignment (IMP-06). Only active roles are offered for
 * new assignment; Administrator membership removal is guarded
 * server-side (last-admin protection), never by hidden UI.
 */
export function UsersAdmin({
  users,
  assignableRoles,
  canManage,
  errorKey,
  returnPath,
  actions,
}: {
  users: readonly UserAccessView[];
  assignableRoles: readonly RoleView[];
  canManage: boolean;
  errorKey?: string;
  returnPath: string;
  actions: {
    assign: AccessFormAction;
    remove: AccessFormAction;
  };
}) {
  const t = useTranslations("access");

  return (
    <main className="auth-page access-page">
      <h1>{t("users.title")}</h1>
      {errorKey ? (
        <p role="alert" className="auth-error">
          {t(`errors.${errorKey}`)}
        </p>
      ) : null}

      {users.map((user) => (
        <section key={user.id} className="access-card">
          <h2>{user.email}</h2>
          {user.roles.length === 0 ? (
            <p>{t("users.noRoles")}</p>
          ) : (
            <ul className="access-permissions">
              {user.roles.map((role) => (
                <li key={role.id}>
                  {role.name}
                  {role.systemKey ? ` (${t("roles.system")})` : ""}
                  {role.isActive ? "" : ` (${t("roles.inactive")})`}
                  {canManage ? (
                    <form action={actions.remove} className="access-inline">
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="roleId" value={role.id} />
                      <input
                        type="hidden"
                        name="returnPath"
                        value={returnPath}
                      />
                      <button type="submit" className="auth-link">
                        {t("users.remove")}
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {canManage && assignableRoles.length > 0 ? (
            <form action={actions.assign} className="access-form">
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <label htmlFor={`assign-${user.id}`}>
                {t("users.assignRole")}
              </label>
              <select id={`assign-${user.id}`} name="roleId">
                {assignableRoles
                  .filter(
                    (role) =>
                      !user.roles.some((assigned) => assigned.id === role.id),
                  )
                  .map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
              </select>
              <button type="submit">{t("users.assign")}</button>
            </form>
          ) : null}
        </section>
      ))}
    </main>
  );
}
