/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PublicNewsArticle } from "@/modules/publishing/presentation/public-news-article";

const labels = {
  breadcrumb: "Breadcrumb",
  listLabel: "News",
  publishedOn: "Published on",
  back: "Back to News",
};

describe("public news article", () => {
  it("renders the same article fields for a resolved revision", () => {
    render(
      <PublicNewsArticle
        locale="en"
        title="Committee session"
        summary="A short summary"
        bodyText="The published body"
        displayDate={new Date(Date.UTC(2024, 0, 10))}
        labels={labels}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Committee session" }),
    ).toBeVisible();
    expect(screen.getByText("A short summary")).toBeVisible();
    expect(screen.getByText("The published body")).toBeVisible();
    expect(
      screen.getByRole("navigation", { name: "Breadcrumb" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "News" })).toHaveAttribute(
      "href",
      "/en/news",
    );
    expect(screen.getByRole("time")).toHaveAttribute("dateTime", "2024-01-10");
  });
});
