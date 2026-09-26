import { useTranslations } from "next-intl";

import type { Locale } from "@/i18n/routing";

import { LogoutButton } from "./logout-button";

/** Localized access-denied experience — safe message, no internal detail. */
export function AccessDenied({ locale }: { locale: Locale }) {
  const t = useTranslations("access");
  return (
    <main className="auth-page">
      <h1>{t("denied.title")}</h1>
      <p role="alert" className="auth-error">
        {t("denied.body")}
      </p>
      <p>
        <a className="auth-link" href={`/${locale}/admin`}>
          {t("denied.backToAdmin")}
        </a>
      </p>
      <LogoutButton locale={locale} />
    </main>
  );
}
