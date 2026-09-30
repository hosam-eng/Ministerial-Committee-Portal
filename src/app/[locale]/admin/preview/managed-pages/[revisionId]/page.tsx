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
  ManagedPagePublicContent,
  resolveManagedPagePreview,
  type ManagedPageContentLabels,
} from "@/modules/managed-pages";
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
}: PreviewParams): Promise<Metadata> {
  await params;
  return { robots: previewRobots };
}

export default async function ManagedPagePreviewPage({
  params,
}: PreviewParams) {
  const { locale, revisionId } = await params;
  setRequestLocale(locale);
  const gate = await requireBackoffice(locale, PERMISSIONS.MANAGED_PAGES_READ);
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
    resolveManagedPagePreview(gate.user.id, revisionId, contentLocale),
    getTranslations({ locale, namespace: "managedPages" }),
    getTranslations({ locale }),
  ]);
  if (!preview) notFound();
  return (
    <PreviewFrame label={t("previewBanner")}>
      <PublicShell
        locale={contentLocale}
        {...await resolvePublicChrome(shell, contentLocale, {
          switchHref: `/${contentLocale === "ar" ? "en" : "ar"}/admin/preview/managed-pages/${revisionId}`,
        })}
      >
        {preview.incomplete && (
          <p className="news-notice" role="status">
            {t("previewIncomplete")}
          </p>
        )}
        <ManagedPagePublicContent
          content={preview.content}
          locale={contentLocale}
          homeHref={`/${contentLocale}`}
          labels={labels(t)}
        />
        <p>
          <a href={`/${locale}/admin/content/pages/${preview.pageId}`}>
            {t("previewBack")}
          </a>
        </p>
      </PublicShell>
    </PreviewFrame>
  );
}
