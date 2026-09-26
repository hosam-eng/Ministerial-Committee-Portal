import { useTranslations } from "next-intl";

import type { Locale } from "@/i18n/routing";

import { PERMISSIONS } from "../domain/permissions";
import { LogoutButton } from "./logout-button";

/**
 * Minimal backoffice landing (IMP-06). Permission-based link visibility
 * is usability only — every target route is still server-authorized.
 */
export function AdminHome({
  email,
  locale,
  permissions,
}: {
  email: string;
  locale: Locale;
  permissions: ReadonlySet<string>;
}) {
  const t = useTranslations();
  return (
    <main className="auth-page">
      <h1>{t("auth.admin.title")}</h1>
      <p>{t("auth.admin.signedInAs", { email })}</p>
      <nav className="auth-nav">
        <ul>
          {permissions.has(PERMISSIONS.ROLES_READ) ? (
            <li>
              <a href={`/${locale}/admin/access/roles`}>
                {t("access.links.roles")}
              </a>
            </li>
          ) : null}
          {permissions.has(PERMISSIONS.USERS_READ) ? (
            <li>
              <a href={`/${locale}/admin/access/users`}>
                {t("access.links.users")}
              </a>
            </li>
          ) : null}
        </ul>
      </nav>
      <LogoutButton locale={locale} />
    </main>
  );
}
