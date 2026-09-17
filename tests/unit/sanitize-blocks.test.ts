import { describe, expect, it } from "vitest";
import { sanitizeBlocks } from "@/lib/sanitize-blocks";

function para(...runs: unknown[]) {
  return { type: "paragraph", content: runs };
}

describe("sanitizeBlocks", () => {
  it("fills missing props and styles", () => {
    const out = sanitizeBlocks([{ type: "paragraph", content: [{ type: "text", text: "hi" }] }]);
    expect(out[0].props).toEqual({});
    const content = out[0].content as Array<{ styles: Record<string, unknown> }>;
    expect(content[0].styles).toEqual({});
  });

  it("converts string content into styled text runs", () => {
    const out = sanitizeBlocks([{ type: "paragraph", content: "hello" }]);
    expect(out[0].content).toEqual([{ type: "text", text: "hello", styles: {} }]);
  });

  it("turns empty string content into an empty content array", () => {
    const out = sanitizeBlocks([{ type: "paragraph", content: "" }]);
    expect(out[0].content).toEqual([]);
  });

  it("migrates legacy styles.link runs to native link inline content", () => {
    const out = sanitizeBlocks([
      para({ type: "text", text: "[[Alpha Note]]", styles: { link: "synapse:Alpha Note", bold: true } }),
    ]);
    const content = out[0].content as Array<Record<string, unknown>>;
    expect(content[0]).toEqual({
      type: "link",
      href: "synapse:Alpha Note",
      content: [{ type: "text", text: "[[Alpha Note]]", styles: { bold: true } }],
    });
  });

  it("strips unknown style keys from text runs", () => {
    const out = sanitizeBlocks([
      para({ type: "text", text: "x", styles: { bold: true, link: "synapse:X", bogus: 1 } }),
    ]);
    const content = out[0].content as Array<Record<string, unknown>>;
    expect(content[0].type).toBe("link"); // migrated, rest dropped
    const inner = (content[0].content as Array<{ styles: Record<string, unknown> }>)[0];
    expect(inner.styles).toEqual({ bold: true });
  });

  it("sanitizes native link runs recursively (inner styles + href)", () => {
    const out = sanitizeBlocks([
      para({
        type: "link",
        href: "synapse:Beta",
        content: [{ type: "text", text: "[[Beta]]", styles: { italic: true, weird: true } }],
      }),
    ]);
    const content = out[0].content as Array<Record<string, unknown>>;
    expect(content[0].href).toBe("synapse:Beta");
    const inner = (content[0].content as Array<{ styles: Record<string, unknown> }>)[0];
    expect(inner.styles).toEqual({ italic: true });
  });

  it("recurses into nested children", () => {
    const out = sanitizeBlocks([
      {
        ...para({ type: "text", text: "top", styles: { link: "synapse:Top" } }),
        children: [{ type: "paragraph", content: "child" }],
      },
    ]);
    const block = out[0] as { content: Array<{ type: string }>; children: Array<{ content: unknown }> };
    expect(block.content[0].type).toBe("link");
    expect(block.children[0].content).toEqual([{ type: "text", text: "child", styles: {} }]);
  });

  it("passes through non-record entries", () => {
    const out = sanitizeBlocks([null, 42, "str"] as unknown[]);
    expect(out).toEqual([null, 42, "str"]);
  });
});
