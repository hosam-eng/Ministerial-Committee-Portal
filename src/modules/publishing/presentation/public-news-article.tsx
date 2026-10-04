import {
  calendarDateTimeAttribute,
  formatPublicCalendarDate,
} from "../display-date";

export type PublicNewsArticleLabels = {
  breadcrumb: string;
  listLabel: string;
  publishedOn: string;
  back: string;
};

export function PublicNewsArticle({
  locale,
  title,
  summary,
  bodyText,
  displayDate,
  labels,
}: {
  locale: "ar" | "en";
  title: string;
  summary: string;
  bodyText: string;
  displayDate: Date | null;
  labels: PublicNewsArticleLabels;
}) {
  return (
    <div className="public-news public-news-detail">
      <nav aria-label={labels.breadcrumb} className="public-news-breadcrumb">
        <a href={`/${locale}/news`}>{labels.listLabel}</a>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">{title}</span>
      </nav>
      <article>
        <header className="public-news-header">
          <h1>{title}</h1>
          {displayDate ? (
            <p className="public-news-date">
              {labels.publishedOn}:{" "}
              <time dateTime={calendarDateTimeAttribute(displayDate)}>
                {formatPublicCalendarDate(displayDate, locale)}
              </time>
            </p>
          ) : null}
          <p className="public-news-summary">{summary}</p>
        </header>
        <p className="public-news-body">{bodyText}</p>
      </article>
      <a className="public-news-back" href={`/${locale}/news`}>
        {labels.back}
      </a>
    </div>
  );
}
