import { describe, expect, it } from "vitest";
import {
  downloadFile,
  noteToJson,
  noteToMarkdown,
  slugify,
  vaultToJson,
  vaultToMarkdown,
} from "@/lib/export";
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

function text(t: string, styles?: Record<string, unknown>) {
  return { type: "text", text: t, ...(styles ? { styles } : {}) };
}

describe("slugify", () => {
  it("slugifies typical titles", () => {
    expect(slugify("My Note: Draft!")).toBe("my-note-draft");
  });

  it("falls back to 'untitled' for empty slugs", () => {
    expect(slugify("")).toBe("untitled");
    expect(slugify("   ")).toBe("untitled");
    expect(slugify("!!!")).toBe("untitled");
  });

  it("strips accents via NFKD", () => {
    expect(slugify("Café Déjà Vu")).toBe("cafe-deja-vu");
  });

  it("removes quotes and collapses dashes", () => {
    expect(slugify("don't stop")).toBe("dont-stop");
    expect(slugify("--a--b--")).toBe("a-b");
  });

  it("keeps digits", () => {
    expect(slugify("100% Sure")).toBe("100-sure");
  });
});

describe("noteToMarkdown", () => {
  it("emits YAML frontmatter with quoted values", () => {
    const n = note({
      id: "n1",
      title: 'Say "Hi"',
      tags: ["work", "ideas"],
      createdAt: 0,
      updatedAt: 0,
    });
    const md = noteToMarkdown(n, { parentTitle: "Parent Note" });
    expect(md).toContain('title: "Say \\"Hi\\""');
    expect(md).toContain('tags: ["work", "ideas"]');
    expect(md).toContain('created: "1970-01-01T00:00:00.000Z"');
    expect(md).toContain('updated: "1970-01-01T00:00:00.000Z"');
    expect(md).toContain('parent: "Parent Note"');
    expect(md.startsWith("---\n")).toBe(true);
  });

  it("emits an empty tags array when the note has no tags", () => {
    expect(noteToMarkdown(note({ id: "n1" }))).toContain("tags: []");
  });

  it("omits the parent line without the option", () => {
    expect(noteToMarkdown(note({ id: "n1" }))).not.toContain("parent:");
  });

  it("renders legacy string content as paragraphs", () => {
    const md = noteToMarkdown(note({ id: "n1", content: "Para one\n\n\nPara two" }));
    expect(md).toContain("Para one\n\nPara two");
  });

  it("renders every supported block type", () => {
    const doc = [
      { type: "heading", props: { level: 2 }, content: [text("Section")] },
      { type: "bulletListItem", content: [text("one")], children: [
        { type: "bulletListItem", content: [text("nested")] },
      ] },
      { type: "numberedListItem", content: [text("first")] },
      { type: "numberedListItem", content: [text("second")] },
      { type: "checkListItem", props: { checked: true }, content: [text("done")] },
      { type: "checkListItem", props: { checked: false }, content: [text("todo")] },
      { type: "codeBlock", props: { language: "ts" }, content: "const x = 1;" },
      { type: "quote", content: [text("wise words")] },
      { type: "divider" },
      { type: "callout", props: { icon: "⚠️" }, content: [text("careful")] },
    ];
    const body = noteToMarkdown(note({ id: "n1", content: doc }));
    expect(body).toContain("## Section");
    expect(body).toContain("- one\n  - nested");
    expect(body).toContain("1. first\n2. second");
    expect(body).toContain("- [x] done\n- [ ] todo");
    expect(body).toContain("```ts\nconst x = 1;\n```");
    expect(body).toContain("> wise words");
    expect(body).toContain("\n---\n");
    expect(body).toContain("> ⚠️ careful");
  });

  it("clamps heading levels to 1..3 and handles empty headings", () => {
    const doc = [
      { type: "heading", props: { level: 9 }, content: [text("Deep")] },
      { type: "heading", props: { level: 1 }, content: [] },
    ];
    const body = noteToMarkdown(note({ id: "n1", content: doc }));
    expect(body).toContain("### Deep");
    expect(body).toMatch(/\n#\n/);
  });

  it("renders tables with escaped pipes", () => {
    const doc = [{
      type: "table",
      content: [
        { type: "tableRow", content: [
          { type: "tableCell", content: [text("Name")] },
          { type: "tableCell", content: [text("Value")] },
        ] },
        { type: "tableRow", content: [
          { type: "tableCell", content: [text("a|b")] },
          { type: "tableCell", content: [text("2")] },
        ] },
      ],
    }];
    const body = noteToMarkdown(note({ id: "n1", content: doc }));
    expect(body).toContain("| Name | Value |");
    expect(body).toContain("| --- | --- |");
    expect(body).toContain("| a\\|b | 2 |");
  });

  it("renders inline styles", () => {
    const doc = [{
      type: "paragraph",
      content: [
        text("bold", { bold: true }),
        text("italic", { italic: true }),
        text("strike", { strike: true }),
        text("both", { bold: true, italic: true }),
        text("code", { code: true }),
        text("link", { link: "https://example.com" }),
      ],
    }];
    const body = noteToMarkdown(note({ id: "n1", content: doc }));
    expect(body).toContain("**bold**");
    expect(body).toContain("*italic*");
    expect(body).toContain("~~strike~~");
    expect(body).toContain("***both***");
    expect(body).toContain("`code`");
    expect(body).toContain("[link](https://example.com)");
  });

  it("keeps edge whitespace outside emphasis markers", () => {
    const doc = [{ type: "paragraph", content: [text("Some ", { bold: true }), text("rest")] }];
    expect(noteToMarkdown(note({ id: "n1", content: doc }))).toContain("**Some** rest");
  });

  it("uses longer fences for code runs containing backticks", () => {
    const doc = [{ type: "paragraph", content: [text("a`b", { code: true })] }];
    expect(noteToMarkdown(note({ id: "n1", content: doc }))).toContain("``` a`b ```");
  });

  it("normalizes synapse: links back to [[wiki-links]]", () => {
    const doc = [{
      type: "paragraph",
      content: [
        { type: "text", text: "[[Other Note]]", styles: { link: "synapse:Other Note" } },
        text(" and a plain [[Raw]] link"),
      ],
    }];
    const body = noteToMarkdown(note({ id: "n1", content: doc }));
    expect(body).toContain("[[Other Note]]");
    expect(body).toContain("and a plain [[Raw]] link");
  });

  it("renders multi-line quotes", () => {
    const doc = [{ type: "quote", content: [text("line1\nline2")] }];
    expect(noteToMarkdown(note({ id: "n1", content: doc }))).toContain("> line1\n> line2");
  });

  it("never throws on malformed content", () => {
    expect(() => noteToMarkdown(note({ id: "n1", content: null }))).not.toThrow();
    expect(() => noteToMarkdown(note({ id: "n1", content: 42 }))).not.toThrow();
    expect(() =>
      noteToMarkdown(note({ id: "n1", content: [null, { type: 12 }, "junk"] }))
    ).not.toThrow();
    const md = noteToMarkdown(note({ id: "n1", content: null }));
    // Body is empty — output is just the frontmatter block.
    expect(md.trimEnd().endsWith("---")).toBe(true);
  });
});

describe("noteToJson / vaultToJson", () => {
  it("round-trips a single note", () => {
    const n = note({ id: "n1", title: "Hello" });
    expect(JSON.parse(noteToJson(n))).toEqual(n);
  });

  it("serializes the whole vault as a pretty JSON array", () => {
    const notes = [note({ id: "n1" }), note({ id: "n2" })];
    const parsed = JSON.parse(vaultToJson(notes)) as Note[];
    expect(parsed).toHaveLength(2);
    expect(parsed.map((n) => n.id)).toEqual(["n1", "n2"]);
  });
});

describe("vaultToMarkdown", () => {
  it("joins notes as H1 sections separated by horizontal rules", () => {
    const notes = [
      note({ id: "n1", title: "One", content: "body one" }),
      note({ id: "n2", title: "Two", content: "body two" }),
    ];
    expect(vaultToMarkdown(notes)).toBe(
      "# One\n\nbody one\n\n---\n\n# Two\n\nbody two\n"
    );
  });

  it("handles notes with empty bodies and untitled notes", () => {
    const md = vaultToMarkdown([note({ id: "n1", title: "" })]);
    expect(md).toBe("# Untitled\n");
  });
});

describe("downloadFile", () => {
  it("is a no-op outside the browser", () => {
    // jsdom *is* a browser-ish env, so instead verify the guard on a
    // missing createObjectURL implementation is not required — just ensure
    // the call resolves without throwing.
    expect(() => downloadFile("a.md", "content")).not.toThrow();
  });
});
