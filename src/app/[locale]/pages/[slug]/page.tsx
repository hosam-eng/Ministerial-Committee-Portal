import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing, type Locale } from "@/i18n/routing";
import {
  ManagedPagePublicContent,
  resolvePublishedManagedPageBySlug,
  type ManagedPageContentLabels,
} from "@/modules/managed-pages";
import { PublicShell } from "@/shared/ui/public-shell";

import { publicChrome } from "../../public-chrome";

export const dynamic = "force-dynamic";

type PageParams = { params: Promise<{ locale: Locale; slug: string }> };

function decodeSlug(slug: string) {
  try {
    return decodeURIComponent(slug);
  } catch {
    notFound();
  }
}

function contentLabels(
  t: Awaited<ReturnType<typeof getTranslations>>,
): ManagedPageContentLabels {
  return {
    breadcrumb: t("public.breadcrumb"),
    home: t("public.home"),
    untitled: t("untitled"),
    callout: {
      institutional: t("variants.INSTITUTIONAL"),
      info: t("variants.INFO"),
      success: t("variants.SUCCESS"),
      warning: t("variants.WARNING"),
      error: t("variants.ERROR"),
    },
  };
}

export async function generateMetadata({
  params,
}: PageParams): Promise<Metadata> {
  const { locale, slug } = await params;
  const resolved = await resolvePublishedManagedPageBySlug(
    locale,
    decodeSlug(slug),
  );
  if (resolved?.kind !== "page")
    return { robots: { index: false, follow: false } };
  const page = resolved.page;
  const otherLocale = locale === "ar" ? "en" : "ar";
  const current = `/${locale}/pages/${encodeURIComponent(page.slug)}`;
  const languages: Record<string, string> = { [locale]: current };
  if (page.counterpartSlug) {
    languages[otherLocale] =
      `/${otherLocale}/pages/${encodeURIComponent(page.counterpartSlug)}`;
  }
  return {
    title: page.seoTitle?.trim() || page.title,
    description: page.seoDescription?.trim() || page.intro || undefined,
    alternates: { canonical: current, languages },
  };
}

export default async function ManagedPagePublicPage({ params }: PageParams) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const resolved = await resolvePublishedManagedPageBySlug(
    locale,
    decodeSlug(slug),
  );
  if (!resolved) notFound();
  if (resolved.kind === "redirect") {
    permanentRedirect(`/${locale}/pages/${encodeURIComponent(resolved.slug)}`);
  }
  const page = resolved.page;
  const t = await getTranslations({ locale, namespace: "managedPages" });
  const shell = await getTranslations({ locale });
  const otherLocale = routing.locales.find(
    (candidate) => candidate !== locale,
  ) as Locale;
  return (
    <PublicShell
      locale={locale}
      {...publicChrome(shell, locale, {
        switchHref: page.counterpartSlug
          ? `/${otherLocale}/pages/${encodeURIComponent(page.counterpartSlug)}`
          : null,
      })}
    >
      <ManagedPagePublicContent
        content={page.content}
        locale={locale}
        homeHref={`/${locale}`}
        labels={contentLabels(t)}
      />
    </PublicShell>
  );
}
