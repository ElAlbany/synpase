import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BacklinksPanel } from "@/components/editor/BacklinksPanel";
import { createNote } from "@/db/notes";
import type { Note } from "@/db/schema";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

function note(partial: Partial<Note> & { id: string }): Note {
  return {
    title: "Untitled",
    content: "",
    parentId: null,
    tags: [],
    isFavorite: false,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

const nativeLinkDoc = (before: string, title: string, after = "") => [
  {
    type: "paragraph",
    content: [
      { type: "text", text: before, styles: {} },
      {
        type: "link",
        href: `synapse:${encodeURIComponent(title)}`,
        content: [{ type: "text", text: `[[${title}]]`, styles: {} }],
      },
      { type: "text", text: after, styles: {} },
    ],
  },
];

describe("BacklinksPanel", () => {
  it("lists notes that link to the open one, with a context snippet", async () => {
    const target = await createNote({ title: "Alpha Note" });
    const source = await createNote({
      title: "Source Note",
      content: nativeLinkDoc("read this first: ", "Alpha Note", " for context"),
    });

    render(
      <BacklinksPanel note={target} notes={[target, source]} onClose={() => {}} />
    );

    expect(screen.getByText("Backlinks · 1")).toBeInTheDocument();
    expect(screen.getByText("Source Note")).toBeInTheDocument();
    expect(screen.getByText(/read this first: \[\[Alpha Note\]\]/)).toBeInTheDocument();
  });

  it("shows the empty state with the [[title]] hint when nothing links here", async () => {
    const target = await createNote({ title: "Lonely Note" });
    render(<BacklinksPanel note={target} notes={[target]} onClose={() => {}} />);

    expect(screen.getByText("Backlinks · 0")).toBeInTheDocument();
    expect(screen.getByText(/Nothing links here yet/)).toBeInTheDocument();
    expect(screen.getByText("[[Lonely Note]]")).toBeInTheDocument();
  });

  it("navigates to the referencing note on click", async () => {
    const target = await createNote({ title: "Alpha Note" });
    const source = await createNote({
      title: "Source Note",
      content: nativeLinkDoc("", "Alpha Note"),
    });
    const user = userEvent.setup();
    pushMock.mockReset();

    render(
      <BacklinksPanel note={target} notes={[target, source]} onClose={() => {}} />
    );

    await user.click(screen.getByText("Source Note"));
    expect(pushMock).toHaveBeenCalledWith(`/app/note/${source.id}`);
  });

  it("excludes the note itself and closes via the close button", async () => {
    const target = note({
      id: "a",
      title: "Self Note",
      content: nativeLinkDoc("", "Self Note"),
    });
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<BacklinksPanel note={target} notes={[target]} onClose={onClose} />);
    expect(screen.getByText("Backlinks · 0")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close backlinks" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
