import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WikiLinkSuggest } from "@/components/editor/WikiLinkSuggest";

const RECT = { left: 100, bottom: 200 };
const TITLES = ["Alpha Note", "Beta Note", "Project Ideas", "Meeting Notes"];

function renderSuggest(query: string, titles = TITLES) {
  const onSelect = vi.fn();
  const onClose = vi.fn();
  render(
    <WikiLinkSuggest query={query} titles={titles} rect={RECT} onSelect={onSelect} onClose={onClose} />
  );
  return { onSelect, onClose };
}

describe("WikiLinkSuggest", () => {
  it("lists all titles for an empty query", () => {
    renderSuggest("");
    const listbox = screen.getByRole("listbox", { name: "Link suggestions" });
    expect(listbox).toBeInTheDocument();
    for (const t of TITLES) expect(screen.getByText(t)).toBeInTheDocument();
  });

  it("filters titles by the query, case-insensitively", () => {
    renderSuggest("note");
    expect(screen.getByText("Alpha Note")).toBeInTheDocument();
    expect(screen.getByText("Beta Note")).toBeInTheDocument();
    expect(screen.getByText("Meeting Notes")).toBeInTheDocument();
    expect(screen.queryByText("Project Ideas")).not.toBeInTheDocument();
  });

  it("offers a create row when no title matches exactly", () => {
    renderSuggest("Gamma");
    expect(screen.getByText(/Create/)).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
  });

  it("Enter picks the active row", async () => {
    const { onSelect, onClose } = renderSuggest("alpha");
    const user = userEvent.setup();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("Alpha Note");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("arrows move the active row and Enter picks it", async () => {
    const { onSelect } = renderSuggest("");
    const user = userEvent.setup();
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onSelect).toHaveBeenCalledWith("Project Ideas");
  });

  it("ArrowUp wraps to the last row", async () => {
    const { onSelect } = renderSuggest("");
    const user = userEvent.setup();
    await user.keyboard("{ArrowUp}{Enter}");
    // last row is "Meeting Notes" (no create row for an empty query)
    expect(onSelect).toHaveBeenCalledWith("Meeting Notes");
  });

  it("Escape closes without selecting", async () => {
    const { onSelect, onClose } = renderSuggest("alpha");
    const user = userEvent.setup();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("mouse click selects a row", async () => {
    const { onSelect } = renderSuggest("");
    const user = userEvent.setup();
    await user.click(screen.getByText("Beta Note"));
    expect(onSelect).toHaveBeenCalledWith("Beta Note");
  });

  it("dedupes titles that differ only by case/whitespace", () => {
    renderSuggest("", ["Alpha Note", "  alpha NOTE  ", "Beta"]);
    const options = screen.getAllByRole("option");
    expect(options.filter((o) => o.textContent?.includes("Alpha Note"))).toHaveLength(1);
  });

  it("renders nothing when there are no titles and no query", () => {
    const { container } = render(
      <WikiLinkSuggest query="" titles={[]} rect={RECT} onSelect={() => {}} onClose={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
