import { describe, expect, it } from "vitest";
import { buildTree, tagColor } from "@/lib/tree";
import type { Note } from "@/db/schema";

function note(id: string, title: string, parentId: string | null = null): Note {
  return {
    id,
    title,
    content: "",
    parentId,
    tags: [],
    isFavorite: false,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("buildTree", () => {
  it("returns an empty tree for no notes", () => {
    expect(buildTree([])).toEqual([]);
  });

  it("nests children under their parents", () => {
    const tree = buildTree([note("a", "Parent"), note("b", "Child", "a")]);
    expect(tree).toHaveLength(1);
    expect(tree[0].note.id).toBe("a");
    expect(tree[0].children.map((c) => c.note.id)).toEqual(["b"]);
  });

  it("promotes orphans (missing parent) to roots", () => {
    const tree = buildTree([note("a", "Real"), note("b", "Orphan", "missing-id")]);
    expect(tree.map((n) => n.note.id).sort()).toEqual(["a", "b"]);
  });

  it("treats null parentId as a root", () => {
    const tree = buildTree([note("a", "Root", null)]);
    expect(tree).toHaveLength(1);
  });

  it("sorts roots and children by title", () => {
    const tree = buildTree([
      note("z", "Zebra"),
      note("a", "Apple"),
      note("m", "Mango"),
      note("c2", "Coconut", "a"),
      note("c1", "Banana", "a"),
    ]);
    expect(tree.map((n) => n.note.title)).toEqual(["Apple", "Mango", "Zebra"]);
    expect(tree[0].children.map((n) => n.note.title)).toEqual(["Banana", "Coconut"]);
  });

  it("handles multi-level nesting", () => {
    const tree = buildTree([
      note("a", "A"),
      note("b", "B", "a"),
      note("c", "C", "b"),
    ]);
    expect(tree[0].children[0].children[0].note.id).toBe("c");
  });

  it("does not crash on parent cycles", () => {
    expect(() => buildTree([note("a", "A", "b"), note("b", "B", "a")])).not.toThrow();
    const tree = buildTree([note("a", "A", "b"), note("b", "B", "a")]);
    // Both nodes reference each other, so neither can be a root.
    expect(tree).toEqual([]);
  });
});

describe("tagColor", () => {
  const PALETTE = [
    "#6E6BFF", "#A78BFA", "#2DD4BF", "#F59E0B",
    "#F87171", "#34D399", "#60A5FA", "#F472B6",
  ];

  it("is stable for the same tag", () => {
    expect(tagColor("research")).toBe(tagColor("research"));
  });

  it("always returns a palette member", () => {
    for (const tag of ["a", "work", "ideas", "inbox", "long-tag-name-123"]) {
      expect(PALETTE).toContain(tagColor(tag));
    }
  });

  it("is case-sensitive in hashing but deterministic", () => {
    expect(tagColor("Work")).toBe(tagColor("Work"));
  });

  it("spreads common tags across the palette", () => {
    const colors = new Set(["work", "personal", "ideas", "reading"].map(tagColor));
    expect(colors.size).toBeGreaterThan(1);
  });
});
