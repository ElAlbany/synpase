import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TagEditor } from "@/components/editor/TagEditor";
import { createNote, getNote } from "@/db/notes";
import type { Note } from "@/db/schema";

async function renderEditor(id: string) {
  const note = (await getNote(id)) as Note;
  const utils = render(<TagEditor note={note} />);
  return {
    ...utils,
    rerender: async () => {
      const fresh = (await getNote(id)) as Note;
      utils.rerender(<TagEditor note={fresh} />);
      return fresh;
    },
  };
}

const typeTag = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(screen.getByRole("button", { name: "Add tag" }));
  const input = screen.getByLabelText("New tag name");
  await user.type(input, name);
  await user.keyboard("{Enter}");
};

describe("TagEditor", () => {
  it("shows the empty state when there are no tags", async () => {
    const note = await createNote();
    await renderEditor(note.id);
    expect(screen.getByText("No tags")).toBeInTheDocument();
  });

  it("adds a tag and persists it to the database", async () => {
    const note = await createNote();
    const user = userEvent.setup();
    await renderEditor(note.id);

    await typeTag(user, "Research");

    await waitFor(async () => {
      expect((await getNote(note.id))!.tags).toEqual(["research"]);
    });
  });

  it("normalizes tags to lowercase dashed form", async () => {
    const note = await createNote();
    const user = userEvent.setup();
    await renderEditor(note.id);

    await typeTag(user, "  My  Cool Tag  ");

    await waitFor(async () => {
      expect((await getNote(note.id))!.tags).toEqual(["my-cool-tag"]);
    });
  });

  it("ignores duplicates", async () => {
    const note = await createNote({ tags: ["work"] });
    const user = userEvent.setup();
    const { rerender } = await renderEditor(note.id);

    expect(screen.getByText("#work")).toBeInTheDocument();
    await typeTag(user, "WORK");
    await waitFor(async () => {
      expect((await getNote(note.id))!.tags).toEqual(["work"]);
    });

    // A rejected duplicate leaves the input open; rerender with fresh props
    // and submit the same tag again.
    await rerender();
    await user.type(screen.getByLabelText("New tag name"), "work");
    await user.keyboard("{Enter}");
    await waitFor(async () => {
      expect((await getNote(note.id))!.tags).toEqual(["work"]);
    });
  });

  it("rejects tags over the 24-character limit", async () => {
    const note = await createNote();
    const user = userEvent.setup();
    await renderEditor(note.id);

    await typeTag(user, "a".repeat(25));

    await waitFor(async () => {
      expect((await getNote(note.id))!.tags).toEqual([]);
    });
  });

  it("enforces the 8-tag maximum", async () => {
    const note = await createNote({ tags: Array.from({ length: 8 }, (_, i) => `t${i}`) });
    const user = userEvent.setup();
    await renderEditor(note.id);

    await user.click(screen.getByRole("button", { name: "Add tag" }));
    const input = screen.getByLabelText("New tag name") as HTMLInputElement;
    expect(input).toBeDisabled();
    expect(input.placeholder).toBe("Max 8 tags");

    await user.type(input, "one-more{Enter}");
    await waitFor(async () => {
      expect((await getNote(note.id))!.tags).toHaveLength(8);
    });
  });

  it("removes a tag", async () => {
    const note = await createNote({ tags: ["keep", "drop"] });
    const user = userEvent.setup();
    await renderEditor(note.id);

    await user.click(screen.getByRole("button", { name: "Remove tag drop" }));

    await waitFor(async () => {
      expect((await getNote(note.id))!.tags).toEqual(["keep"]);
    });
  });

  it("cancels adding on Escape", async () => {
    const note = await createNote();
    const user = userEvent.setup();
    await renderEditor(note.id);

    await user.click(screen.getByRole("button", { name: "Add tag" }));
    const input = screen.getByLabelText("New tag name");
    await user.type(input, "partial{Escape}");

    expect(screen.queryByLabelText("New tag name")).not.toBeInTheDocument();
    expect((await getNote(note.id))!.tags).toEqual([]);
  });
});
