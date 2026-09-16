import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createNote,
  deleteNote,
  findNoteByTitle,
  getNote,
  listRecent,
  noteExcerpt,
  toggleFavorite,
  updateNote,
} from "@/db/notes";

let now = 1_700_000_000_000;

beforeEach(() => {
  now = 1_700_000_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const tick = (ms = 1_000) => {
  now += ms;
};

describe("createNote", () => {
  it("applies defaults for empty input", async () => {
    const note = await createNote();
    expect(note.title).toBe("Untitled");
    expect(note.content).toBe("");
    expect(note.parentId).toBeNull();
    expect(note.tags).toEqual([]);
    expect(note.isFavorite).toBe(false);
    expect(note.createdAt).toBe(note.updatedAt);
    expect(await getNote(note.id)).toEqual(note);
  });

  it("accepts partial input and keeps defaults for the rest", async () => {
    const note = await createNote({ title: "Hello", tags: ["work"] });
    expect(note.title).toBe("Hello");
    expect(note.tags).toEqual(["work"]);
    expect(note.parentId).toBeNull();
  });

  it("assigns unique ids", async () => {
    const a = await createNote();
    const b = await createNote();
    expect(a.id).not.toBe(b.id);
  });
});

describe("updateNote", () => {
  it("applies changes and bumps updatedAt", async () => {
    const note = await createNote({ title: "Before" });
    tick();
    await updateNote(note.id, { title: "After" });
    const stored = (await getNote(note.id))!;
    expect(stored.title).toBe("After");
    expect(stored.updatedAt).toBeGreaterThan(stored.createdAt);
  });

  it("does not touch other fields", async () => {
    const note = await createNote({ title: "T", tags: ["x"] });
    tick();
    await updateNote(note.id, { isFavorite: true });
    const stored = (await getNote(note.id))!;
    expect(stored.tags).toEqual(["x"]);
    expect(stored.title).toBe("T");
  });
});

describe("deleteNote", () => {
  it("re-parents children onto the deleted note's parent", async () => {
    const grandparent = await createNote({ title: "Grandparent" });
    const parent = await createNote({ title: "Parent", parentId: grandparent.id });
    const child = await createNote({ title: "Child", parentId: parent.id });

    await deleteNote(parent.id);

    expect(await getNote(parent.id)).toBeUndefined();
    const storedChild = (await getNote(child.id))!;
    expect(storedChild.parentId).toBe(grandparent.id);
  });

  it("re-parents children to null when deleting a root note", async () => {
    const parent = await createNote({ title: "Root" });
    const child = await createNote({ title: "Child", parentId: parent.id });

    await deleteNote(parent.id);

    expect((await getNote(child.id))!.parentId).toBeNull();
  });

  it("is a no-op for a missing id", async () => {
    await expect(deleteNote("no-such-id")).resolves.toBeUndefined();
  });
});

describe("toggleFavorite", () => {
  it("flips isFavorite on and off", async () => {
    const note = await createNote();
    await toggleFavorite(note.id);
    expect((await getNote(note.id))!.isFavorite).toBe(true);
    await toggleFavorite(note.id);
    expect((await getNote(note.id))!.isFavorite).toBe(false);
  });
});

describe("findNoteByTitle", () => {
  it("matches case-insensitively and trims", async () => {
    const note = await createNote({ title: "My Note" });
    expect((await findNoteByTitle("my note"))!.id).toBe(note.id);
    expect((await findNoteByTitle("  MY NOTE  "))!.id).toBe(note.id);
  });

  it("returns undefined for empty queries and misses", async () => {
    await createNote({ title: "Something" });
    expect(await findNoteByTitle("   ")).toBeUndefined();
    expect(await findNoteByTitle("Nope")).toBeUndefined();
  });
});

describe("listRecent", () => {
  it("orders by updatedAt, most recent first", async () => {
    const a = await createNote({ title: "A" });
    tick();
    const b = await createNote({ title: "B" });
    tick();
    const c = await createNote({ title: "C" });

    const recent = await listRecent();
    expect(recent.map((n) => n.id)).toEqual([c.id, b.id, a.id]);

    tick();
    await updateNote(a.id, { title: "A2" });
    expect((await listRecent())[0].id).toBe(a.id);
  });

  it("respects the limit", async () => {
    for (let i = 0; i < 5; i++) {
      await createNote({ title: `N${i}` });
      tick();
    }
    expect(await listRecent(3)).toHaveLength(3);
  });
});

describe("noteExcerpt", () => {
  it("collapses whitespace and truncates with an ellipsis", () => {
    const note = {
      id: "x",
      title: "T",
      content: "  a   b  " + "c".repeat(200),
      parentId: null,
      tags: [],
      isFavorite: false,
      createdAt: 0,
      updatedAt: 0,
    };
    const excerpt = noteExcerpt(note, 140);
    expect(excerpt.startsWith("a b ccc")).toBe(true);
    expect(excerpt.endsWith("…")).toBe(true);
    expect(excerpt.length).toBe(141);
  });

  it("returns short text unchanged", () => {
    const note = {
      id: "x",
      title: "T",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hi there" }] }],
      parentId: null,
      tags: [],
      isFavorite: false,
      createdAt: 0,
      updatedAt: 0,
    };
    expect(noteExcerpt(note)).toBe("hi there");
  });

  it("handles empty content", () => {
    const note = {
      id: "x", title: "T", content: "", parentId: null,
      tags: [], isFavorite: false, createdAt: 0, updatedAt: 0,
    };
    expect(noteExcerpt(note)).toBe("");
  });
});
