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
  loadNavigationRevisionDraft,
  resolveNavigationPreview,
} from "@/modules/public-navigation";
import { resolvePublicChrome } from "../../../../public-chrome";
import { previewRobots } from "@/shared/preview/safety";
import { PreviewFrame } from "@/shared/ui/preview-frame";
import { PublicShell } from "@/shared/ui/public-shell";

export const dynamic = "force-dynamic";

type PreviewParams = {
  params: Promise<{ locale: string; revisionId: string }>;
};

export async function generateMetadata({
  params,
}: PreviewParams): Promise<Metadata> {
  await params;
  return { robots: previewRobots };
}

export default async function NavigationPreviewPage({ params }: PreviewParams) {
  const { locale, revisionId } = await params;
  setRequestLocale(locale);
  const gate = await requireBackoffice(locale, PERMISSIONS.NAVIGATION_READ);
  if (gate.status === "denied")
    return <AccessDenied locale={locale as Locale} />;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      revisionId,
    )
  ) {
    notFound();
  }

  const contentLocale = locale === "en" ? "en" : "ar";
  const [preview, draft, t, shell] = await Promise.all([
    resolveNavigationPreview(gate.user.id, revisionId, contentLocale),
    loadNavigationRevisionDraft(revisionId),
    getTranslations({ locale, namespace: "navigation" }),
    getTranslations({ locale }),
  ]);
  if (!preview || !draft) notFound();

  const chrome = await resolvePublicChrome(shell, contentLocale, {
    switchHref: `/${contentLocale === "ar" ? "en" : "ar"}/admin/preview/navigation/${revisionId}`,
    previewNavigationDraft: draft,
  });

  return (
    <PreviewFrame label={t("previewBanner")}>
      <PublicShell locale={contentLocale} {...chrome}>
        {preview.incomplete ? (
          <p className="news-notice" role="status">
            {t("previewIncomplete")}
          </p>
        ) : null}
        <p className="news-muted">{t("previewBody")}</p>
        <p>
          <a href={`/${locale}/admin/navigation`}>{t("previewBack")}</a>
        </p>
      </PublicShell>
    </PreviewFrame>
  );
}
