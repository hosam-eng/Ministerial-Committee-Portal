"use client";

import { useTranslations } from "next-intl";

/**
 * Route-segment error boundary. Generic localized message only — the real
 * error stays server-side; no stack details reach the UI.
 */
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");

  return (
    <main className="bootstrap-page">
      <h1>{t("title")}</h1>
      <p>{t("body")}</p>
      <button type="button" onClick={reset}>
        {t("retry")}
      </button>
    </main>
  );
}
