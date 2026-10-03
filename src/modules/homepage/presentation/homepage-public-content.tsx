import {
  calendarDateTimeAttribute,
  formatPublicCalendarDate,
} from "@/modules/publishing";

import type { PublicHomepage } from "../domain/public-view";

export type HomepagePublicMessages = {
  viewAllNews: string;
  publishedOn: string;
};

export function HomepagePublicContent({
  locale,
  homepage,
  messages,
}: {
  locale: "ar" | "en";
  homepage: PublicHomepage;
  messages: HomepagePublicMessages;
}) {
  return (
    <div className="public-homepage">
      {homepage.sections.map((section, index) => {
        if (section.type === "hero") {
          const { hero } = section;
          return (
            <section
              key={`hero-${index}`}
              className="public-homepage-hero"
              aria-labelledby="public-homepage-hero-title"
            >
              {hero.title.trim() ? (
                <h1 id="public-homepage-hero-title">{hero.title}</h1>
              ) : null}
              {hero.supportingText.trim() ? <p>{hero.supportingText}</p> : null}
              {hero.cta ? (
                <p>
                  <a
                    className="ui-button ui-button-primary"
                    href={hero.cta.href}
                    {...(hero.cta.external
                      ? { rel: "noopener noreferrer", target: "_blank" }
                      : {})}
                  >
                    {hero.cta.label}
                  </a>
                </p>
              ) : null}
            </section>
          );
        }
        const { news } = section;
        return (
          <section
            key={`news-${index}`}
            className="public-homepage-news"
            aria-labelledby="public-homepage-news-title"
          >
            <header className="public-homepage-news-header">
              {news.heading.trim() ? (
                <h2 id="public-homepage-news-title">{news.heading}</h2>
              ) : null}
              <p>
                <a href={news.viewAllHref}>{messages.viewAllNews}</a>
              </p>
            </header>
            {news.items.length ? (
              <ul className="public-homepage-news-grid">
                {news.items.map((item) => (
                  <li key={item.newsId}>
                    <article className="public-homepage-news-card">
                      <p className="public-news-date">
                        {messages.publishedOn}:{" "}
                        <time
                          dateTime={calendarDateTimeAttribute(item.displayDate)}
                        >
                          {formatPublicCalendarDate(item.displayDate, locale)}
                        </time>
                      </p>
                      <h3>
                        <a href={item.href}>{item.title}</a>
                      </h3>
                      <p>{item.summary}</p>
                    </article>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
