import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing, type Locale } from "@/i18n/routing";
import { PublicShell } from "@/shared/ui/public-shell";

/**
 * Localized public landing — IMP-08 renders it inside PublicShell.
 * Content stays intentionally minimal; IMP-17 owns the real homepage.
 */
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale });
  const otherLocale = routing.locales.find(
    (candidate) => candidate !== locale,
  ) as Locale;

  return (
    <PublicShell
      locale={locale}
      identity={t("app.name")}
      switchTo={{
        href: `/${otherLocale}`,
        lang: otherLocale,
        label: t("shell.language"),
        ariaLabel: t("shell.languageSwitch"),
      }}
      skipLabel={t("shell.skipToContent")}
      footerText={t("shell.copyright", { year: new Date().getFullYear() })}
    >
      <h1>{t("home.title")}</h1>
      <p>{t("home.body")}</p>
    </PublicShell>
  );
}
