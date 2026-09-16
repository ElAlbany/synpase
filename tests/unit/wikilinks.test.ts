import { describe, expect, it } from "vitest";
import {
  blocksToText,
  contextAround,
  extractWikiLinks,
  getBacklinks,
  transformWikiLinks,
} from "@/lib/wikilinks";
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

function para(...runs: unknown[]) {
  return { type: "paragraph", content: runs };
}

function text(text: string, styles?: Record<string, unknown>) {
  return { type: "text", text, ...(styles ? { styles } : {}) };
}

describe("extractWikiLinks", () => {
  it("extracts a single link", () => {
    expect(extractWikiLinks("See [[Alpha]] for details")).toEqual(["Alpha"]);
  });

  it("extracts multiple links in order", () => {
    expect(extractWikiLinks("[[One]] then [[Two]] and [[Three]]")).toEqual([
      "One",
      "Two",
      "Three",
    ]);
  });

  it("trims whitespace inside the brackets", () => {
    expect(extractWikiLinks("[[  Spaced out  ]]")).toEqual(["Spaced out"]);
  });

  it("skips links that trim to nothing", () => {
    expect(extractWikiLinks("[[  ]]")).toEqual([]);
  });

  it("returns an empty array when there are no links", () => {
    expect(extractWikiLinks("just plain text")).toEqual([]);
    expect(extractWikiLinks("")).toEqual([]);
  });

  it("keeps duplicate mentions", () => {
    expect(extractWikiLinks("[[A]] and [[A]]")).toEqual(["A", "A"]);
  });
});

describe("blocksToText", () => {
  it("passes plain strings through unchanged", () => {
    expect(blocksToText("legacy content")).toBe("legacy content");
  });

  it("flattens top-level text runs", () => {
    expect(blocksToText([para(text("hello"), text(" world"))])).toBe("hello world");
  });

  it("walks nested children", () => {
    const blocks = [
      {
        ...para(text("top")),
        children: [{ ...para(text("child")), children: [para(text("grandchild"))] }],
      },
    ];
    expect(blocksToText(blocks)).toBe("top child grandchild");
  });

  it("supports blocks whose content is a bare string", () => {
    expect(blocksToText([{ type: "codeBlock", content: "const x = 1;" }])).toBe("const x = 1;");
  });

  it("collapses whitespace between runs", () => {
    expect(blocksToText([para(text("a"), { type: "text", text: "\n  b" })])).toBe("a b");
  });

  it("returns an empty string for malformed input", () => {
    expect(blocksToText(undefined)).toBe("");
    expect(blocksToText(null)).toBe("");
    expect(blocksToText(42)).toBe("");
    expect(blocksToText([null, 42, "str", {}])).toBe("");
  });

  it("skips non-record runs inside content arrays", () => {
    expect(blocksToText([para(text("keep"), null, 7)])).toBe("keep");
  });
});

describe("transformWikiLinks", () => {
  it("splits a run around a link and marks the link with a synapse: href", () => {
    const blocks = [para({ type: "text", text: "see [[Alpha Note]] now" })];
    const out = transformWikiLinks(blocks) as Array<{ content: Array<Record<string, unknown>> }>;

    expect(out[0].content).toHaveLength(3);
    expect(out[0].content[0]).toMatchObject({ text: "see " });
    expect(out[0].content[1]).toMatchObject({
      text: "[[Alpha Note]]",
      styles: { link: "synapse:Alpha Note" },
    });
    expect(out[0].content[2]).toMatchObject({ text: " now" });
  });

  it("preserves existing styles on the split runs", () => {
    const run = { type: "text", text: "[[Bold Link]]", styles: { bold: true } };
    const out = transformWikiLinks([para(run)]) as Array<{
      content: Array<{ styles: Record<string, unknown> }>;
    }>;
    expect(out[0].content).toHaveLength(1);
    expect(out[0].content[0].styles).toEqual({ bold: true, link: "synapse:Bold Link" });
  });

  it("leaves runs without links untouched (same reference)", () => {
    const run = { type: "text", text: "plain" };
    const out = transformWikiLinks([para(run)]) as Array<{ content: unknown[] }>;
    expect(out[0].content[0]).toBe(run);
  });

  it("handles a run made of only a link", () => {
    const out = transformWikiLinks([para({ type: "text", text: "[[Solo]]" })]) as Array<{
      content: Array<{ text: string; styles: { link: string } }>;
    }>;
    expect(out[0].content).toHaveLength(1);
    expect(out[0].content[0].styles.link).toBe("synapse:Solo");
  });

  it("recurses into nested children", () => {
    const blocks = [
      {
        ...para({ type: "text", text: "no links here" }),
        children: [para({ type: "text", text: "child [[Beta]]" })],
      },
    ];
    const out = transformWikiLinks(blocks) as Array<{
      children: Array<{ content: Array<{ styles?: { link?: string } }> }>;
    }>;
    const childContent = out[0].children[0].content;
    expect(childContent).toHaveLength(2);
    expect(childContent[1].styles?.link).toBe("synapse:Beta");
  });

  it("leaves non-text runs alone", () => {
    const mention = { type: "mention", text: "[[NotALink]]" };
    const out = transformWikiLinks([para(mention)]) as Array<{ content: unknown[] }>;
    expect(out[0].content[0]).toBe(mention);
  });

  it("passes non-array input through", () => {
    expect(transformWikiLinks("string")).toBe("string");
    expect(transformWikiLinks(null)).toBe(null);
  });
});

describe("contextAround", () => {
  it("returns the full text with no ellipsis when it fits", () => {
    expect(contextAround("short [[Target]] text", "Target")).toBe("short [[Target]] text");
  });

  it("returns null when the title is not mentioned", () => {
    expect(contextAround("nothing here", "Missing")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(contextAround("see [[target]] ok", "Target")).toBe("see [[target]] ok");
  });

  it("truncates long text with ellipses on both sides", () => {
    const padding = "x".repeat(200);
    const text = `${padding} [[Target]] ${padding}`;
    const ctx = contextAround(text, "Target", 20)!;
    expect(ctx.startsWith("…")).toBe(true);
    expect(ctx.endsWith("…")).toBe(true);
    expect(ctx).toContain("[[Target]]");
    expect(ctx.length).toBeLessThan(text.length);
  });
});

describe("getBacklinks", () => {
  const target = note({ id: "a", title: "Alpha" });

  it("finds notes linking to the target", () => {
    const source = note({ id: "b", title: "B", content: "read [[Alpha]] first" });
    const out = getBacklinks([target, source], target);
    expect(out).toHaveLength(1);
    expect(out[0].note.id).toBe("b");
    expect(out[0].context).toContain("[[Alpha]]");
  });

  it("matches case-insensitively", () => {
    const source = note({ id: "b", title: "B", content: "mentions [[ALPHA]] here" });
    expect(getBacklinks([target, source], target)).toHaveLength(1);
  });

  it("excludes the target note itself", () => {
    const self = note({ id: "a", title: "Alpha", content: "self [[Alpha]] link" });
    expect(getBacklinks([self], self)).toEqual([]);
  });

  it("returns nothing when the target has no title", () => {
    const untitled = note({ id: "a", title: "   " });
    const source = note({ id: "b", content: "[[ ]] nothing" });
    expect(getBacklinks([untitled, source], untitled)).toEqual([]);
  });

  it("sorts by updatedAt, most recently edited first", () => {
    const older = note({ id: "b", content: "[[Alpha]]", updatedAt: 100 });
    const newer = note({ id: "c", content: "[[Alpha]]", updatedAt: 200 });
    const out = getBacklinks([target, older, newer], target);
    expect(out.map((b) => b.note.id)).toEqual(["c", "b"]);
  });
});
