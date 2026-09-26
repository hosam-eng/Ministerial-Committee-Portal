import { useTranslations } from "next-intl";

/** Locale-aware not-found surface; renders inside the [locale] layout. */
export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <main className="bootstrap-page">
      <h1>{t("title")}</h1>
      <p>{t("body")}</p>
    </main>
  );
}
