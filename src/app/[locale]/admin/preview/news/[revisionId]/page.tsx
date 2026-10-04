import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import {
  AccessDenied,
  PERMISSIONS,
  requireBackoffice,
} from "@/modules/identity";
import {
  PublicNewsArticle,
  resolveNewsPreview,
  type PublicNewsArticleLabels,
} from "@/modules/publishing";
import { previewRobots } from "@/shared/preview/safety";
import { PreviewFrame } from "@/shared/ui/preview-frame";
import { PublicShell } from "@/shared/ui/public-shell";

import { resolvePublicChrome } from "../../../../public-chrome";

export const dynamic = "force-dynamic";

type PreviewParams = {
  params: Promise<{ locale: string; revisionId: string }>;
};

function labels(
  t: Awaited<ReturnType<typeof getTranslations>>,
): PublicNewsArticleLabels {
  return {
    breadcrumb: t("publicNews.breadcrumb"),
    listLabel: t("publicNews.title"),
    publishedOn: t("publicNews.publishedOn"),
    back: t("publicNews.back"),
  };
}

export async function generateMetadata({
  params,
}: PreviewParams): Promise<Metadata> {
  await params;
  return { robots: previewRobots };
}

export default async function NewsPreviewPage({ params }: PreviewParams) {
  const { locale, revisionId } = await params;
  setRequestLocale(locale);
  const gate = await requireBackoffice(locale, PERMISSIONS.NEWS_READ);
  if (gate.status === "denied")
    return <AccessDenied locale={locale as Locale} />;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      revisionId,
    )
  )
    notFound();
  const contentLocale = locale === "en" ? "en" : "ar";
  const otherLocale = contentLocale === "ar" ? "en" : "ar";
  const [preview, t, shell] = await Promise.all([
    resolveNewsPreview(gate.user.id, revisionId, contentLocale),
    getTranslations({ locale, namespace: "news" }),
    getTranslations({ locale }),
  ]);
  if (!preview) notFound();
  return (
    <PreviewFrame label={t("previewBanner")}>
      <PublicShell
        locale={contentLocale}
        {...await resolvePublicChrome(shell, contentLocale, {
          switchHref: `/${otherLocale}/admin/preview/news/${revisionId}`,
        })}
      >
        {preview.incomplete && (
          <p className="news-notice" role="status">
            {t("previewIncomplete")}
          </p>
        )}
        <PublicNewsArticle
          locale={contentLocale}
          title={preview.article.title}
          summary={preview.article.summary}
          bodyText={preview.article.bodyText}
          displayDate={preview.article.displayDate}
          labels={labels(shell)}
        />
        <p>
          <a href={`/${locale}/admin/content/news/${preview.newsId}`}>
            {t("previewBack")}
          </a>
        </p>
      </PublicShell>
    </PreviewFrame>
  );
}
