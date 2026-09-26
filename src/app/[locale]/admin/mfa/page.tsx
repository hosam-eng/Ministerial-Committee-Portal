import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import type { Locale } from "@/i18n/routing";
import { getAdminAuthState, MfaChallengeForm } from "@/modules/identity";

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

  return <MfaChallengeForm locale={locale as Locale} />;
}
