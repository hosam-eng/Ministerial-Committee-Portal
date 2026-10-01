/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomepagePublicContent } from "@/modules/homepage";

describe("homepage public content", () => {
  it("renders hero text and a three-card news grid link", () => {
    render(
      <HomepagePublicContent
        locale="en"
        messages={{ viewAllNews: "View all news", publishedOn: "Published" }}
        homepage={{
          sections: [
            {
              type: "hero",
              hero: {
                title: "Welcome",
                supportingText: "Supporting copy",
                cta: { label: "News", href: "/en/news" },
              },
            },
            {
              type: "news",
              news: {
                heading: "Latest",
                viewAllHref: "/en/news",
                items: [
                  {
                    newsId: "11111111-1111-4111-8111-111111111111",
                    title: "One",
                    summary: "Summary one",
                    slug: "one",
                    publishedAt: new Date("2026-01-01T00:00:00.000Z"),
                    href: "/en/news/one",
                  },
                  {
                    newsId: "22222222-2222-4222-8222-222222222222",
                    title: "Two",
                    summary: "Summary two",
                    slug: "two",
                    publishedAt: new Date("2026-01-02T00:00:00.000Z"),
                    href: "/en/news/two",
                  },
                  {
                    newsId: "33333333-3333-4333-8333-333333333333",
                    title: "Three",
                    summary: "Summary three",
                    slug: "three",
                    publishedAt: new Date("2026-01-03T00:00:00.000Z"),
                    href: "/en/news/three",
                  },
                ],
              },
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Welcome",
    );
    expect(screen.getByText("Supporting copy")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "News" })).toHaveAttribute(
      "href",
      "/en/news",
    );
    expect(screen.getByRole("link", { name: "View all news" })).toHaveAttribute(
      "href",
      "/en/news",
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items.map((item) => item.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("One"),
        expect.stringContaining("Two"),
        expect.stringContaining("Three"),
      ]),
    );
    expect(document.querySelector(".public-homepage-news-grid")).toBeTruthy();
    expect(screen.queryByText(/back to homepage/i)).toBeNull();
  });

  it("preserves manual news item order in the grid", () => {
    render(
      <HomepagePublicContent
        locale="en"
        messages={{ viewAllNews: "View all news", publishedOn: "Published" }}
        homepage={{
          sections: [
            {
              type: "news",
              news: {
                heading: "Latest",
                viewAllHref: "/en/news",
                items: [
                  {
                    newsId: "33333333-3333-4333-8333-333333333333",
                    title: "Third",
                    summary: "Three",
                    slug: "three",
                    publishedAt: new Date("2026-01-03T00:00:00.000Z"),
                    href: "/en/news/three",
                  },
                  {
                    newsId: "11111111-1111-4111-8111-111111111111",
                    title: "First",
                    summary: "One",
                    slug: "one",
                    publishedAt: new Date("2026-01-01T00:00:00.000Z"),
                    href: "/en/news/one",
                  },
                ],
              },
            },
          ],
        }}
      />,
    );

    const titles = screen
      .getAllByRole("listitem")
      .map((item) => item.querySelector("h3")?.textContent);
    expect(titles).toEqual(["Third", "First"]);
  });

  it("omits CTA when hero cta is null", () => {
    render(
      <HomepagePublicContent
        locale="en"
        messages={{ viewAllNews: "View all news", publishedOn: "Published" }}
        homepage={{
          sections: [
            {
              type: "hero",
              hero: {
                title: "Welcome",
                supportingText: "Copy",
                cta: null,
              },
            },
          ],
        }}
      />,
    );
    expect(screen.queryByRole("link", { name: /news/i })).toBeNull();
  });
});
