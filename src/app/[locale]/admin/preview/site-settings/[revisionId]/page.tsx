import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import {
  AccessDenied,
  PERMISSIONS,
  requireBackoffice,
} from "@/modules/identity";
import { resolveSiteSettingsPreview } from "@/modules/site-settings";
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

export default async function SiteSettingsPreviewPage({
  params,
}: PreviewParams) {
  const { locale, revisionId } = await params;
  setRequestLocale(locale);
  const gate = await requireBackoffice(locale, PERMISSIONS.SITE_SETTINGS_READ);
  if (gate.status === "denied")
    return <AccessDenied locale={locale as Locale} />;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      revisionId,
    )
  )
    notFound();

  const contentLocale = locale === "en" ? "en" : "ar";
  const [preview, t, shell] = await Promise.all([
    resolveSiteSettingsPreview(gate.user.id, revisionId, contentLocale),
    getTranslations({ locale, namespace: "siteSettings" }),
    getTranslations({ locale }),
  ]);
  if (!preview) notFound();

  const chrome = await resolvePublicChrome(shell, contentLocale, {
    switchHref: `/${contentLocale === "ar" ? "en" : "ar"}/admin/preview/site-settings/${revisionId}`,
    previewShell: preview.shell,
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
          <a href={`/${locale}/admin/site-settings`}>{t("previewBack")}</a>
        </p>
      </PublicShell>
    </PreviewFrame>
  );
}
