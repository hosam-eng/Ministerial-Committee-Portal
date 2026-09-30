import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getDirection, routing } from "@/i18n/routing";
import {
  composePublicSeoDescription,
  composePublicSeoTitle,
  resolveLiveDefaultSeo,
} from "@/modules/site-settings";

// DGA Platforms Code tokens/reset — imported once at the root via the
// shared/ui vendor boundary (IMP-08). Must precede portal styles.
import "@/shared/ui/dga/core.css";
import "@/styles/globals.css";
import "@/styles/ui-foundation.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "app" });
  const contentLocale = locale === "en" ? "en" : "ar";
  const liveSeo = await resolveLiveDefaultSeo(contentLocale);

  return {
    title: composePublicSeoTitle({
      liveDefaultTitle: liveSeo?.title,
      staticFallback: t("name"),
    }),
    description: composePublicSeoDescription({
      liveDefaultDescription: liveSeo?.description,
    }),
    icons: { icon: "/brand/committee-logo-icon.svg" },
    alternates: {
      canonical: `/${locale}`,
      languages: {
        ar: "/ar",
        en: "/en",
      },
    },
  };
}

/**
 * Root document layout, scoped to the explicit "/{locale}" segment so
 * `lang`/`dir` are correct in server-rendered HTML — no client-side
 * direction mutation.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html lang={locale} dir={getDirection(locale)}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
