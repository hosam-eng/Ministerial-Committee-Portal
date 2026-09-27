import { useTranslations } from "next-intl";

/** Server action signature passed in from the route layer. */
export type AccessFormAction = (formData: FormData) => Promise<void>;

export interface RoleView {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly systemKey: string | null;
  readonly isActive: boolean;
  readonly permissionKeys: readonly string[];
}

export interface CatalogPermissionView {
  readonly id: string;
  readonly key: string;
}

/**
 * Roles management (IMP-06). System roles render read-only; custom
 * roles get edit/permission/activation controls only when the actor
 * holds identity.roles.manage — and every mutation re-checks the
 * permission server-side regardless of what the UI renders.
 */
export function RolesAdmin({
  roles,
  catalog,
  canManage,
  errorKey,
  returnPath,
  actions,
}: {
  roles: readonly RoleView[];
  catalog: readonly CatalogPermissionView[];
  canManage: boolean;
  errorKey?: string;
  returnPath: string;
  actions: {
    create: AccessFormAction;
    update: AccessFormAction;
    setActive: AccessFormAction;
  };
}) {
  const t = useTranslations("access");
  // Permission labels are nested to mirror the dotted permission keys
  // (next-intl forbids "." inside a JSON key itself).
  const labels = t.raw("permissions") as Record<string, unknown>;
  const labelFor = (key: string) => {
    const node = key
      .split(".")
      .reduce<unknown>(
        (n, segment) =>
          n !== null && typeof n === "object" && !Array.isArray(n)
            ? (n as Record<string, unknown>)[segment]
            : undefined,
        labels,
      );
    return typeof node === "string" ? node : key;
  };
  // IMP-08: system-role descriptions are localized catalog text, not the
  // stored (English) DB description. Custom-role descriptions stay as
  // entered — they are user data, not catalog text.
  const systemDescriptions = t.raw("roles.systemDescriptions") as Record<
    string,
    string
  >;
  const systemDescription = (systemKey: string) =>
    systemDescriptions[systemKey];

  return (
    <div className="access-page">
      <h1>{t("roles.title")}</h1>
      {errorKey ? (
        <p role="alert" className="auth-error">
          {t(`errors.${errorKey}`)}
        </p>
      ) : null}

      {roles.map((role) => {
        const isSystem = role.systemKey !== null;
        return (
          <section key={role.id} className="access-card">
            <h2>
              {role.name}{" "}
              <span className="access-badge">
                {isSystem ? t("roles.system") : t("roles.custom")}
              </span>{" "}
              <span className="access-badge">
                {role.isActive ? t("roles.active") : t("roles.inactive")}
              </span>
            </h2>
            {isSystem ? (
              <>
                <p>{t("roles.readOnlyNotice")}</p>
                <p>
                  {t("roles.description")}:{" "}
                  {systemDescription(role.systemKey) ??
                    role.description ??
                    t("roles.noDescription")}
                </p>
                <ul className="access-permissions">
                  {role.permissionKeys.map((key) => (
                    <li key={key}>{labelFor(key)}</li>
                  ))}
                </ul>
              </>
            ) : canManage ? (
              <>
                <form action={actions.update} className="access-form">
                  <input type="hidden" name="roleId" value={role.id} />
                  <input type="hidden" name="returnPath" value={returnPath} />
                  <div>
                    <label htmlFor={`name-${role.id}`}>{t("roles.name")}</label>
                    <input
                      id={`name-${role.id}`}
                      name="name"
                      defaultValue={role.name}
                      maxLength={80}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor={`desc-${role.id}`}>
                      {t("roles.description")}
                    </label>
                    <input
                      id={`desc-${role.id}`}
                      name="description"
                      defaultValue={role.description ?? ""}
                      maxLength={280}
                    />
                  </div>
                  <fieldset>
                    <legend>{t("roles.permissions")}</legend>
                    {catalog.map((permission) => (
                      <label key={permission.id} className="access-checkbox">
                        <input
                          type="checkbox"
                          name="permissions"
                          value={permission.id}
                          defaultChecked={role.permissionKeys.includes(
                            permission.key,
                          )}
                        />
                        {labelFor(permission.key)}
                      </label>
                    ))}
                  </fieldset>
                  <button type="submit">{t("roles.save")}</button>
                </form>
                <form action={actions.setActive}>
                  <input type="hidden" name="roleId" value={role.id} />
                  <input type="hidden" name="returnPath" value={returnPath} />
                  <input
                    type="hidden"
                    name="active"
                    value={role.isActive ? "false" : "true"}
                  />
                  <button type="submit">
                    {role.isActive
                      ? t("roles.deactivate")
                      : t("roles.activate")}
                  </button>
                </form>
              </>
            ) : (
              <>
                <p>
                  {t("roles.description")}:{" "}
                  {role.description ?? t("roles.noDescription")}
                </p>
                <ul className="access-permissions">
                  {role.permissionKeys.map((key) => (
                    <li key={key}>{labelFor(key)}</li>
                  ))}
                </ul>
              </>
            )}
          </section>
        );
      })}

      {canManage ? (
        <section className="access-card">
          <h2>{t("roles.createTitle")}</h2>
          <form action={actions.create} className="access-form">
            <input type="hidden" name="returnPath" value={returnPath} />
            <div>
              <label htmlFor="new-name">{t("roles.name")}</label>
              <input id="new-name" name="name" maxLength={80} required />
            </div>
            <div>
              <label htmlFor="new-desc">{t("roles.description")}</label>
              <input id="new-desc" name="description" maxLength={280} />
            </div>
            <fieldset>
              <legend>{t("roles.permissions")}</legend>
              {catalog.map((permission) => (
                <label key={permission.id} className="access-checkbox">
                  <input
                    type="checkbox"
                    name="permissions"
                    value={permission.id}
                  />
                  {labelFor(permission.key)}
                </label>
              ))}
            </fieldset>
            <button type="submit">{t("roles.create")}</button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
