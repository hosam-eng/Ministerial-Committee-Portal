import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing, type Locale } from "@/i18n/routing";
import {
  HomepagePublicContent,
  resolveLivePublicHomepage,
} from "@/modules/homepage";
import { PublicShell } from "@/shared/ui/public-shell";

import { resolvePublicChrome } from "./public-chrome";

export const dynamic = "force-dynamic";

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

  const contentLocale = locale === "en" ? "en" : "ar";
  const [chrome, liveHomepage, publicNewsT, homepageT] = await Promise.all([
    resolvePublicChrome(t, locale, {
      switchHref: `/${otherLocale}`,
      currentPath: `/${locale}`,
    }),
    resolveLivePublicHomepage(contentLocale),
    getTranslations({ locale, namespace: "publicNews" }),
    getTranslations({ locale, namespace: "homepage" }),
  ]);

  return (
    <PublicShell locale={locale} {...chrome}>
      {liveHomepage ? (
        <HomepagePublicContent
          locale={contentLocale}
          homepage={liveHomepage}
          messages={{
            viewAllNews: homepageT("public.viewAllNews"),
            publishedOn: publicNewsT("publishedOn"),
          }}
        />
      ) : (
        <>
          <h1>{t("home.title")}</h1>
          <p>{t("home.body")}</p>
        </>
      )}
    </PublicShell>
  );
}
