import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { getAdminAuthState, LoginForm } from "@/modules/identity";

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

  return <LoginForm locale={locale as Locale} />;
}
