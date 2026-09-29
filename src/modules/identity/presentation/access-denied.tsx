"use client";

import { useTranslations } from "next-intl";

import type { Locale } from "@/i18n/routing";

/** Localized access-denied experience — safe message, no internal detail. */
export function AccessDenied({ locale }: { locale: Locale }) {
  const t = useTranslations("access");
  return (
    <div className="auth-access-denied ui-surface">
      <h1>{t("denied.title")}</h1>
      <p role="alert" className="ui-alert ui-alert-error">
        {t("denied.body")}
      </p>
      <a className="ui-button ui-button-primary" href={`/${locale}/admin`}>
        {t("denied.backToAdmin")}
      </a>
    </div>
  );
}
