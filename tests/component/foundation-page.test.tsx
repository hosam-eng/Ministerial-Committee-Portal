/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";

describe("foundation page", () => {
  it("renders exactly one level-1 heading inside the main landmark", () => {
    render(<HomePage />);

    expect(screen.getByRole("main")).toBeInTheDocument();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Ministerial Committee Portal");
    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });
});
