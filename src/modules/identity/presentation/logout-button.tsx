"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { Locale } from "@/i18n/routing";

import { authClient } from "./auth-client";

/** Revokes the server-side session and returns to the localized login. */
export function LogoutButton({ locale }: { locale: Locale }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onLogout() {
    setPending(true);
    try {
      await authClient.signOut();
    } finally {
      router.replace(`/${locale}/admin/login`);
      router.refresh();
    }
  }

  return (
    <button type="button" onClick={onLogout} disabled={pending}>
      {pending ? t("admin.loggingOut") : t("admin.logout")}
    </button>
  );
}
