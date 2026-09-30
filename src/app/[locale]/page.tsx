import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing, type Locale } from "@/i18n/routing";
import { PublicShell } from "@/shared/ui/public-shell";

import { resolvePublicChrome } from "./public-chrome";

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

  const chrome = await resolvePublicChrome(t, locale, {
    switchHref: `/${otherLocale}`,
  });

  return (
    <PublicShell locale={locale} {...chrome}>
      <h1>{t("home.title")}</h1>
      <p>{t("home.body")}</p>
    </PublicShell>
  );
}
