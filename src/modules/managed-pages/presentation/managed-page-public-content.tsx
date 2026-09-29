import type { ManagedPageContent } from "../domain/content";
import { EXTERNAL_LINK_REL, EXTERNAL_LINK_TARGET } from "../domain/links";
import type { ManagedPageLocale } from "../domain/locales";
import { RichTextPublicView } from "./rich-text/rich-text-render-public";

export type ManagedPageContentLabels = {
  breadcrumb: string;
  home: string;
  untitled: string;
  callout: Record<
    "institutional" | "info" | "success" | "warning" | "error",
    string
  >;
};

export function ManagedPagePublicContent({
  content,
  locale,
  homeHref,
  labels,
}: {
  content: ManagedPageContent;
  locale: ManagedPageLocale;
  homeHref: string;
  labels: ManagedPageContentLabels;
}) {
  const title = content.title || labels.untitled;
  return (
    <article
      className="managed-page public-managed-page"
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      <nav className="managed-page-breadcrumb" aria-label={labels.breadcrumb}>
        <a href={homeHref}>{labels.home}</a>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">{title}</span>
      </nav>
      <h1>{title}</h1>
      {content.intro ? (
        <p className="managed-page-intro">{content.intro}</p>
      ) : null}
      <div className="managed-page-blocks">
        {content.blocks.map((block) => {
          if (block.type === "RICHTEXT") {
            return (
              <RichTextPublicView
                key={block.id}
                document={block.document}
                internalHrefs={block.internalHrefs}
                locale={locale}
              />
            );
          }
          if (block.type === "CALLOUT") {
            return (
              <aside
                key={block.id}
                className={`managed-callout managed-callout-${block.variant}`}
                role="note"
              >
                <p className="managed-callout-label">
                  {labels.callout[block.variant]}
                </p>
                {block.title ? (
                  <p className="managed-callout-title">{block.title}</p>
                ) : null}
                <p>{block.body}</p>
              </aside>
            );
          }
          if (!block.heading && !block.items.length) return null;
          return (
            <section key={block.id} className="managed-link-list">
              {block.heading ? <h2>{block.heading}</h2> : null}
              <ul>
                {block.items.map((item) => (
                  <li key={item.id}>
                    {item.href ? (
                      <a
                        href={item.href}
                        {...(item.href.startsWith("https://")
                          ? {
                              target: EXTERNAL_LINK_TARGET,
                              rel: EXTERNAL_LINK_REL,
                            }
                          : {})}
                      >
                        {item.label}
                      </a>
                    ) : (
                      <span>{item.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </article>
  );
}
