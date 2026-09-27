import { getTranslations, setRequestLocale } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import {
  AccessDenied,
  PERMISSIONS,
  requireBackoffice,
} from "@/modules/identity";

import { createNewsAction } from "../actions";

export default async function NewNewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const gate = await requireBackoffice(locale, PERMISSIONS.NEWS_CREATE);
  if (gate.status === "denied")
    return <AccessDenied locale={locale as Locale} />;
  const [t, { error }] = await Promise.all([
    getTranslations({ locale, namespace: "news" }),
    searchParams,
  ]);
  return (
    <section className="news-workspace">
      <a href={`/${locale}/admin/content/news`}>{t("back")}</a>
      <div className="news-heading">
        <div>
          <p className="news-eyebrow">{t("section")}</p>
          <h1>{t("create")}</h1>
          <p>{t("createIntro")}</p>
        </div>
      </div>
      {error && (
        <p role="alert" className="news-alert">
          {t.has(`errors.${error}`)
            ? t(`errors.${error}`)
            : t("errors.generic")}
        </p>
      )}
      <form action={createNewsAction}>
        <input type="hidden" name="locale" value={locale} />
        <button className="news-button news-primary" type="submit">
          {t("createDraft")}
        </button>
      </form>
    </section>
  );
}
