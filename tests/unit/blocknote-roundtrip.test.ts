import { describe, expect, it } from "vitest";
import { BlockNoteEditor, type PartialBlock } from "@blocknote/core";
import { sanitizeBlocks } from "@/lib/sanitize-blocks";
import { transformWikiLinks } from "@/lib/wikilinks";

/**
 * Regression guard for the storage-format bug: wiki-links must round-trip
 * through BlockNote without throwing ("style link not found in styleSchema").
 */
describe("BlockNote round-trip", () => {
  it("loads a document with transformed [[wiki-links]] without throwing", () => {
    const blocks = [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "see ", styles: {} },
          { type: "text", text: "[[Alpha Note]]", styles: {} },
          { type: "text", text: " now", styles: {} },
        ],
      },
    ];
    const transformed = transformWikiLinks(blocks);
    expect(() =>
      BlockNoteEditor.create({ initialContent: transformed as PartialBlock[] })
    ).not.toThrow();
  });

  it("loads a sanitized legacy document (styles.link) without throwing", () => {
    const legacy = [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "[[Alpha Note]]", styles: { link: "synapse:Alpha Note" } },
        ],
      },
    ];
    const sanitized = sanitizeBlocks(legacy);
    expect(() =>
      BlockNoteEditor.create({ initialContent: sanitized })
    ).not.toThrow();
  });

  it("loads a document with native external links without throwing", () => {
    const doc = [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "docs ", styles: {} },
          {
            type: "link",
            href: "https://example.com",
            content: [{ type: "text", text: "here", styles: {} }],
          },
        ],
      },
    ];
    const sanitized = sanitizeBlocks(doc);
    expect(() =>
      BlockNoteEditor.create({ initialContent: sanitized })
    ).not.toThrow();
  });
});
