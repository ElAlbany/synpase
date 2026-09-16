import { describe, expect, it } from "vitest";
import {
  createNotesIndex,
  excerptAround,
  highlightQuery,
  searchNotes,
} from "@/lib/search";
import type { Note } from "@/db/schema";

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

const indexOf = (notes: Note[]) => createNotesIndex(notes);

describe("createNotesIndex + searchNotes", () => {
  it("finds notes by body text", () => {
    const notes = [
      note({ id: "n1", title: "Crystals", content: "quartz is a crystal" }),
      note({ id: "n2", title: "Unrelated", content: "nothing to see" }),
    ];
    const results = searchNotes(indexOf(notes), "quartz");
    expect(results.map((r) => r.id)).toEqual(["n1"]);
    expect(results[0].terms).toContain("quartz");
  });

  it("boosts title matches above body matches", () => {
    const notes = [
      note({ id: "title-hit", title: "Alpha project", content: "nothing relevant" }),
      note({ id: "body-hit", title: "Other note", content: "alpha in the body only" }),
    ];
    const results = searchNotes(indexOf(notes), "alpha");
    expect(results.map((r) => r.id)).toEqual(["title-hit", "body-hit"]);
  });

  it("prefix-matches once the term has two characters", () => {
    const notes = [note({ id: "n1", title: "Graphite thoughts", content: "" })];
    const results = searchNotes(indexOf(notes), "graph");
    expect(results.map((r) => r.id)).toContain("n1");
  });

  it("returns nothing for an empty or whitespace query", () => {
    const index = indexOf([note({ id: "n1", title: "Anything", content: "body" })]);
    expect(searchNotes(index, "")).toEqual([]);
    expect(searchNotes(index, "   ")).toEqual([]);
    expect(searchNotes(null, "anything")).toEqual([]);
  });

  it("filters by tags", () => {
    const notes = [
      note({ id: "work", title: "Meeting Notes", tags: ["work"] }),
      note({ id: "home", title: "Meeting Notes", tags: ["personal"] }),
    ];
    const results = searchNotes(indexOf(notes), "meeting", { tags: ["work"] });
    expect(results.map((r) => r.id)).toEqual(["work"]);
  });

  it("returns stored fields on results", () => {
    const notes = [
      note({
        id: "n1",
        title: "Hello",
        content: [{ type: "paragraph", content: [{ type: "text", text: "world text" }] }],
        tags: ["x"],
        updatedAt: 42,
        parentId: "parent-id",
      }),
    ];
    const [r] = searchNotes(indexOf(notes), "hello");
    expect(r).toMatchObject({
      id: "n1",
      title: "Hello",
      text: "world text",
      tags: ["x"],
      updatedAt: 42,
      parentId: "parent-id",
    });
    expect(typeof r.score).toBe("number");
  });

  it("respects the limit option", () => {
    const notes = Array.from({ length: 5 }, (_, i) =>
      note({ id: `n${i}`, title: `List item ${i}` })
    );
    expect(searchNotes(indexOf(notes), "list", { limit: 2 })).toHaveLength(2);
  });
});

describe("highlightQuery", () => {
  it("flags exact matches as segments", () => {
    expect(highlightQuery("hello alpha world", ["alpha"])).toEqual([
      { text: "hello ", match: false },
      { text: "alpha", match: true },
      { text: " world", match: false },
    ]);
  });

  it("matches case-insensitively but preserves original casing", () => {
    expect(highlightQuery("An ALPHA test", ["alpha"])).toEqual([
      { text: "An ", match: false },
      { text: "ALPHA", match: true },
      { text: " test", match: false },
    ]);
  });

  it("handles multiple terms, longest first", () => {
    expect(highlightQuery("graphics and graph", ["graph", "graphics"])).toEqual([
      { text: "graphics", match: true },
      { text: " and ", match: false },
      { text: "graph", match: true },
    ]);
  });

  it("treats regex metacharacters literally", () => {
    expect(highlightQuery("a.b and axb", ["a.b"])).toEqual([
      { text: "a.b", match: true },
      { text: " and axb", match: false },
    ]);
  });

  it("returns the whole text as non-match when no terms are given", () => {
    expect(highlightQuery("plain", [])).toEqual([{ text: "plain", match: false }]);
    expect(highlightQuery("plain", ["  "])).toEqual([{ text: "plain", match: false }]);
  });

  it("returns nothing for empty text", () => {
    expect(highlightQuery("", ["x"])).toEqual([]);
  });
});

describe("excerptAround", () => {
  it("returns short text unchanged (whitespace-collapsed)", () => {
    expect(excerptAround("  already short  ", ["x"])).toBe("already short");
  });

  it("truncates around the first term match with ellipses", () => {
    const text = `${"a".repeat(300)}needle${"b".repeat(300)}`;
    const excerpt = excerptAround(text, ["needle"], 90);
    expect(excerpt).toContain("needle");
    expect(excerpt.startsWith("…")).toBe(true);
    expect(excerpt.endsWith("…")).toBe(true);
    expect(excerpt.length).toBeLessThanOrEqual(92);
  });

  it("falls back to a head-truncate when nothing matches", () => {
    const text = "x".repeat(300);
    const excerpt = excerptAround(text, ["missing"], 100);
    expect(excerpt.startsWith("x")).toBe(true);
    expect(excerpt.endsWith("…")).toBe(true);
    expect(excerpt).not.toContain("missing");
  });

  it("prefers the earliest match among several terms", () => {
    const text = `first ${"filler ".repeat(40)} second here`;
    const excerpt = excerptAround(text, ["second", "first"], 60);
    expect(excerpt).toContain("first");
  });
});
