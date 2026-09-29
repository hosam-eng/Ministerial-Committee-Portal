import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing, type Locale } from "@/i18n/routing";
import { getAdminAuthState, MfaChallengeForm } from "@/modules/identity";
import { AuthShell } from "@/shared/ui/auth-shell";

export const dynamic = "force-dynamic";

/**
 * Second-factor challenge — reachable only while a pending MFA
 * challenge exists (password verified, TOTP/backup code outstanding).
 */
export default async function AdminMfaPage({
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
  if (state.status === "mfa-enrollment-required") {
    redirect(`/${locale}/admin/mfa/setup`);
  }
  if (state.status === "unauthenticated") {
    redirect(`/${locale}/admin/login`);
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
        href: `/${otherLocale}/admin/mfa`,
        lang: otherLocale,
        label: t("shell.language"),
        ariaLabel: t("shell.languageSwitch"),
      }}
    >
      <MfaChallengeForm locale={locale as Locale} />
    </AuthShell>
  );
}
