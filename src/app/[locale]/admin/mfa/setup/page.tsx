import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing, type Locale } from "@/i18n/routing";
import { getAdminAuthState, MfaSetupForm } from "@/modules/identity";
import { AuthShell } from "@/shared/ui/auth-shell";

export const dynamic = "force-dynamic";

/**
 * Mandatory first-login TOTP enrollment. Requires a live session for an
 * account that has not enrolled MFA yet — no session → login, enrolled →
 * admin.
 */
export default async function AdminMfaSetupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const state = await getAdminAuthState();
  if (state.status === "authenticated") {
    redirect(`/${locale}/admin`);
  }
  if (state.status === "unauthenticated") {
    redirect(`/${locale}/admin/login`);
  }
  if (state.status === "mfa-challenge-pending") {
    redirect(`/${locale}/admin/mfa`);
  }

  const t = await getTranslations({ locale });
  const otherLocale = routing.locales.find(
    (candidate) => candidate !== locale,
  ) as Locale;

  return (
    <AuthShell
      locale={locale}
      productTitle={t("app.name")}
      switchTo={{
        href: `/${otherLocale}/admin/mfa/setup`,
        lang: otherLocale,
        label: t("shell.language"),
        ariaLabel: t("shell.languageSwitch"),
      }}
    >
      <MfaSetupForm locale={locale as Locale} />
    </AuthShell>
  );
}
