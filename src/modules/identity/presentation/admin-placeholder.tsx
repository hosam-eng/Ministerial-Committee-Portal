import { useTranslations } from "next-intl";

import type { Locale } from "@/i18n/routing";

import { LogoutButton } from "./logout-button";

/**
 * Minimal authenticated proof page — authentication only, no admin
 * shell. Authorization and real backoffice capabilities arrive in
 * IMP-06.
 */
export function AdminPlaceholder({
  email,
  locale,
}: {
  email: string;
  locale: Locale;
}) {
  const t = useTranslations("auth");

  return (
    <main className="auth-page">
      <h1>{t("admin.title")}</h1>
      <p>{t("admin.signedInAs", { email })}</p>
      <p>{t("admin.authorizationLater")}</p>
      <LogoutButton locale={locale} />
    </main>
  );
}
