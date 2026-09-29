import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing, type Locale } from "@/i18n/routing";
import { getAdminAuthState, LoginForm } from "@/modules/identity";
import { AuthShell } from "@/shared/ui/auth-shell";

export const dynamic = "force-dynamic";

/**
 * Localized backoffice login. Users who already hold a session are sent
 * forward — fully authenticated → /admin, enrolled-not-verified → MFA
 * setup, mid-challenge → MFA challenge.
 */
export default async function AdminLoginPage({
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
        href: `/${otherLocale}/admin/login`,
        lang: otherLocale,
        label: t("shell.language"),
        ariaLabel: t("shell.languageSwitch"),
      }}
    >
      <LoginForm locale={locale as Locale} />
    </AuthShell>
  );
}
