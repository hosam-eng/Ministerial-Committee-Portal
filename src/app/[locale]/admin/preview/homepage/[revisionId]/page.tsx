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
  HomepagePublicContent,
  loadRevisionDraft,
  resolveHomepageDraftToPublic,
  resolveHomepagePreview,
} from "@/modules/homepage";
import { resolvePublicChrome } from "../../../../public-chrome";
import { previewRobots } from "@/shared/preview/safety";
import { getRuntimeDatabase } from "@/platform/runtime";
import { PreviewFrame } from "@/shared/ui/preview-frame";
import { PublicShell } from "@/shared/ui/public-shell";

export const dynamic = "force-dynamic";

type PreviewParams = {
  params: Promise<{ locale: string; revisionId: string }>;
  searchParams: Promise<{ locale?: string }>;
};

export async function generateMetadata({
  params,
}: PreviewParams): Promise<Metadata> {
  await params;
  return { robots: previewRobots };
}

export default async function HomepagePreviewPage({
  params,
  searchParams,
}: PreviewParams) {
  const { locale, revisionId } = await params;
  setRequestLocale(locale);
  const gate = await requireBackoffice(locale, PERMISSIONS.HOMEPAGE_READ);
  if (gate.status === "denied")
    return <AccessDenied locale={locale as Locale} />;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      revisionId,
    )
  ) {
    notFound();
  }

  const query = await searchParams;
  const contentLocale =
    query.locale === "en" || query.locale === "ar"
      ? query.locale
      : locale === "en"
        ? "en"
        : "ar";

  const [preview, draft, t, shell, publicT] = await Promise.all([
    resolveHomepagePreview(gate.user.id, revisionId, contentLocale),
    loadRevisionDraft(revisionId),
    getTranslations({ locale, namespace: "homepage" }),
    getTranslations({ locale }),
    getTranslations({ locale: contentLocale, namespace: "publicNews" }),
  ]);
  if (!preview || !draft) notFound();

  const publicHomepage = await resolveHomepageDraftToPublic(
    draft,
    contentLocale,
    getRuntimeDatabase(),
  );
  const chrome = await resolvePublicChrome(shell, contentLocale, {
    switchHref: `/${contentLocale === "ar" ? "en" : "ar"}/admin/preview/homepage/${revisionId}?locale=${contentLocale === "ar" ? "en" : "ar"}`,
  });

  return (
    <PreviewFrame label={t("previewBanner")}>
      <PublicShell locale={contentLocale} {...chrome}>
        {preview.incomplete ? (
          <div className="news-notice" role="status">
            <p>{t("previewIncomplete")}</p>
            {preview.incompleteIssueKeys.length ? (
              <ul>
                {preview.incompleteIssueKeys.map((key) => (
                  <li key={key}>
                    {t.has(`completeness.${key}`)
                      ? t(`completeness.${key}`)
                      : t("errors.generic")}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <HomepagePublicContent
          locale={contentLocale}
          homepage={publicHomepage}
          messages={{
            viewAllNews: t("public.viewAllNews"),
            publishedOn: publicT("publishedOn"),
          }}
        />
      </PublicShell>
    </PreviewFrame>
  );
}
