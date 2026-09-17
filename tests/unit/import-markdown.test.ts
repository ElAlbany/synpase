import { describe, expect, it } from "vitest";
import {
  MarkdownImportError,
  markdownToBlocks,
  markdownToNote,
  MAX_MARKDOWN_BYTES,
  parseInline,
} from "@/lib/import-markdown";

interface Run {
  type: string;
  text: string;
  styles: Record<string, unknown>;
  href?: string;
}

interface Block {
  type: string;
  props: Record<string, unknown>;
  content: Run[];
  children: Block[];
}

function blocks(md: string): Block[] {
  return markdownToBlocks(md) as Block[];
}

function text(block: Block): string {
  return block.content.map((r) => r.text).join("");
}

describe("markdownToBlocks: block structure", () => {
  it("parses #, ##, ### headings and clamps deeper levels to 3", () => {
    const [h1, h2, h3, h6] = blocks("# One\n## Two\n### Three\n###### Six");
    expect(h1).toMatchObject({ type: "heading", props: { level: 1 } });
    expect(h2).toMatchObject({ type: "heading", props: { level: 2 } });
    expect(h3).toMatchObject({ type: "heading", props: { level: 3 } });
    expect(h6.props.level).toBe(3);
    expect(text(h1)).toBe("One");
  });

  it("splits paragraphs on blank lines and joins soft line breaks", () => {
    const result = blocks("first\nsecond\n\nthird");
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("paragraph");
    expect(text(result[0])).toBe("first\nsecond");
    expect(text(result[1])).toBe("third");
  });

  it("parses -, *, and + bullets", () => {
    const result = blocks("- a\n* b\n+ c");
    expect(result.map((b) => b.type)).toEqual([
      "bulletListItem",
      "bulletListItem",
      "bulletListItem",
    ]);
    expect(result.map(text)).toEqual(["a", "b", "c"]);
  });

  it("parses numbered lists", () => {
    const result = blocks("1. one\n2. two\n10. ten");
    expect(result.every((b) => b.type === "numberedListItem")).toBe(true);
    expect(result.map(text)).toEqual(["one", "two", "ten"]);
  });

  it("parses checkboxes with checked state", () => {
    const result = blocks("- [ ] todo\n- [x] done\n- [X] also done");
    expect(result.every((b) => b.type === "checkListItem")).toBe(true);
    expect(result.map((b) => b.props.checked)).toEqual([false, true, true]);
  });

  it("parses fenced code blocks with language", () => {
    const result = blocks("```ts\nconst x = 1;\n```");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("codeBlock");
    expect(result[0].props.language).toBe("ts");
    expect(text(result[0])).toBe("const x = 1;");
  });

  it("parses quotes, joining consecutive lines", () => {
    const result = blocks("> line one\n> line two");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("quote");
    expect(text(result[0])).toBe("line one\nline two");
  });

  it("parses --- dividers", () => {
    const result = blocks("above\n\n---\n\nbelow");
    expect(result.map((b) => b.type)).toEqual(["paragraph", "divider", "paragraph"]);
  });

  it("nests indented list items as children", () => {
    const result = blocks("- parent\n  - child\n    - grandchild\n- sibling");
    expect(result).toHaveLength(2);
    const [parent, sibling] = result;
    expect(text(parent)).toBe("parent");
    expect(parent.children).toHaveLength(1);
    expect(text(parent.children[0])).toBe("child");
    expect(parent.children[0].children).toHaveLength(1);
    expect(text(parent.children[0].children[0])).toBe("grandchild");
    expect(text(sibling)).toBe("sibling");
    expect(sibling.children).toHaveLength(0);
  });

  it("handles mixed block types in one document", () => {
    const md = [
      "# Title",
      "",
      "Intro paragraph.",
      "",
      "- item",
      "- [x] done",
      "",
      "> wise words",
      "",
      "```js",
      "code()",
      "```",
      "",
      "---",
    ].join("\n");
    const types = blocks(md).map((b) => b.type);
    expect(types).toEqual([
      "heading",
      "paragraph",
      "bulletListItem",
      "checkListItem",
      "quote",
      "codeBlock",
      "divider",
    ]);
  });
});

describe("markdownToBlocks: inline styles", () => {
  it("parses **bold**, *italic*, and `code`", () => {
    const [p] = blocks("a **bold** b *italic* c `code` d");
    expect(p.content.map((r) => [r.text, r.styles])).toEqual([
      ["a ", {}],
      ["bold", { bold: true }],
      [" b ", {}],
      ["italic", { italic: true }],
      [" c ", {}],
      ["code", { code: true }],
      [" d", {}],
    ]);
  });

  it("parses [text](url) links as native link inline content", () => {
    const [p] = blocks("see [the docs](https://example.com) now");
    const link = p.content.find((r) => r.type === "link");
    expect(link).toMatchObject({
      type: "link",
      href: "https://example.com",
      content: [{ type: "text", text: "the docs", styles: {} }],
    });
  });

  it("rejects unsafe link schemes (kept as plain text)", () => {
    const [p] = blocks("click [x](javascript:alert(1)) here");
    expect(p.content.some((r) => r.type === "link")).toBe(false);
    expect(p.content.map((r) => r.text).join("")).toContain("click");
  });

  it("preserves [[wiki-links]] as plain-text runs", () => {
    const [p] = blocks("related to [[Some Note]] here");
    const wiki = p.content.find((r) => r.text === "[[Some Note]]");
    expect(wiki).toBeDefined();
    expect(wiki?.styles).toEqual({});
    expect(p.content.some((r) => r.styles.link)).toBe(false);
  });

  it("parses __bold__ and _italic_ underscores", () => {
    const [p] = blocks("__b__ _i_");
    expect(p.content[0]).toMatchObject({ text: "b", styles: { bold: true } });
    expect(p.content[2]).toMatchObject({ text: "i", styles: { italic: true } });
  });

  it("leaves markers inside code spans untouched", () => {
    const [p] = blocks("`**not bold**`");
    expect(p.content).toEqual([
      { type: "text", text: "**not bold**", styles: { code: true } },
    ]);
  });

  it("every run carries a styles object; links carry an href (BlockNote 0.28 requirement)", () => {
    const all = blocks("# t\n\npara **b** *i* `c` [l](https://x.co) [[w]]\n\n- [ ] task");
    for (const b of all) {
      for (const r of b.content) {
        if (r.type === "link") {
          expect(r.href).toBeTypeOf("string");
          for (const inner of (r as unknown as { content: Run[] }).content) {
            expect(inner.styles).toBeTypeOf("object");
          }
          continue;
        }
        expect(r.styles).toBeTypeOf("object");
      }
      expect(b.props).toBeTypeOf("object");
    }
  });

  it("parseInline returns plain runs for unstyled text", () => {
    expect(parseInline("hello world")).toEqual([
      { type: "text", text: "hello world", styles: {} },
    ]);
  });
});

describe("markdownToBlocks: robustness", () => {
  it("handles CRLF and CR line endings", () => {
    const result = blocks("# A\r\n\r\npara\r\n- item\r- other");
    expect(result.map((b) => b.type)).toEqual([
      "heading",
      "paragraph",
      "bulletListItem",
      "bulletListItem",
    ]);
  });

  it("strips NUL bytes", () => {
    const [p] = blocks("hel\0lo");
    expect(text(p)).toBe("hello");
  });

  it("never throws on malformed input", () => {
    const samples = [
      "",
      "\n\n\n",
      "```\nunclosed fence",
      "> ",
      "#",
      "- ",
      "- [",
      "[[",
      "**dangling",
      "*dangling",
      "`dangling",
      "[text](",
      "(((( ))))",
      "#'.repeat(0)",
    ];
    for (const md of samples) {
      expect(() => markdownToBlocks(md), JSON.stringify(md)).not.toThrow();
    }
    expect(markdownToBlocks("")).toEqual([]);
  });

  it("returns [] for non-string input", () => {
    expect(markdownToBlocks(null as unknown as string)).toEqual([]);
    expect(markdownToBlocks(undefined as unknown as string)).toEqual([]);
    expect(markdownToBlocks(42 as unknown as string)).toEqual([]);
  });

  it("rejects input over 2 MB with a clear error", () => {
    const huge = "x".repeat(MAX_MARKDOWN_BYTES + 1);
    expect(() => markdownToBlocks(huge)).toThrow(MarkdownImportError);
    expect(() => markdownToBlocks(huge)).toThrow(/too large/i);
    const atCap = "x".repeat(MAX_MARKDOWN_BYTES);
    expect(() => markdownToBlocks(atCap)).not.toThrow();
  });

  it("unclosed code fence consumes to EOF without throwing", () => {
    const result = blocks("```py\nprint(1)\nprint(2)");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: "codeBlock", props: { language: "py" } });
    expect(text(result[0])).toBe("print(1)\nprint(2)");
  });
});

describe("markdownToNote", () => {
  it("uses the first H1 as the title", () => {
    const note = markdownToNote("# My Title\n\nbody", "file.md");
    expect(note.title).toBe("My Title");
  });

  it("strips inline markdown from the H1 title", () => {
    const note = markdownToNote("# **Bold** `code` [link](https://x.co)", "file.md");
    expect(note.title).toBe("Bold code link");
  });

  it("falls back to the filename minus extension", () => {
    expect(markdownToNote("no heading", "Deep Work.md").title).toBe("Deep Work");
    expect(markdownToNote("no heading", "notes/daily.markdown").title).toBe("daily");
    expect(markdownToNote("no heading", "plain.txt").title).toBe("plain");
  });

  it("falls back to Untitled for empty filenames", () => {
    expect(markdownToNote("no heading", "").title).toBe("Untitled");
    expect(markdownToNote("no heading", ".md").title).toBe("Untitled");
  });

  it("rejects oversize input", () => {
    const huge = "x".repeat(MAX_MARKDOWN_BYTES + 1);
    expect(() => markdownToNote(huge, "big.md")).toThrow(MarkdownImportError);
  });
});
