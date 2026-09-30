import { getTranslations } from "next-intl/server";

/** Locale-aware not-found surface; renders inside the [locale] layout. */
export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <main className="bootstrap-page">
      <h1>{t("title")}</h1>
      <p>{t("body")}</p>
    </main>
  );
}
