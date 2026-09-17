import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import GuidePage from "@/app/(app)/app/guide/page";

describe("GuidePage", () => {
  it("renders the how-to sections", () => {
    render(<GuidePage />);

    expect(screen.getByRole("heading", { name: "How to use Synapse" })).toBeInTheDocument();
    expect(screen.getByText(/Write your first note/)).toBeInTheDocument();
    expect(screen.getByText(/Link notes together/)).toBeInTheDocument();
    expect(screen.getByText(/backlinks & graph/i)).toBeInTheDocument();
    expect(screen.getByText(/Organize: tags & favorites/)).toBeInTheDocument();
    expect(screen.getByText(/Find anything instantly/)).toBeInTheDocument();
    expect(screen.getByText(/Keyboard shortcuts/)).toBeInTheDocument();
  });

  it("links back to home from both the top and bottom buttons", () => {
    render(<GuidePage />);
    const backLinks = screen.getAllByRole("link", { name: /Back home/ });
    expect(backLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of backLinks) {
      expect(link).toHaveAttribute("href", "/app");
    }
  });

  it("mentions the [[wiki-link]] workflow and Cmd K", () => {
    render(<GuidePage />);
    expect(screen.getAllByText(/\[\[/).length).toBeGreaterThan(0);
    expect(screen.getByText("Cmd K")).toBeInTheDocument();
  });
});
