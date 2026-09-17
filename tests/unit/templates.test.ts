import { describe, expect, it } from "vitest";
import {
  applyTemplate,
  DEFAULT_TEMPLATE_ID,
  getTemplate,
  TEMPLATES,
} from "@/lib/templates";

interface Run {
  type?: unknown;
  text?: unknown;
  styles?: unknown;
}

interface Block {
  type?: unknown;
  props?: unknown;
  content?: unknown;
  children?: unknown;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Recursively assert a valid BlockNote partial-block shape. */
function assertValidBlock(raw: unknown, path: string): void {
  expect(isRecord(raw), `${path}: block is an object`).toBe(true);
  const block = raw as Block;
  expect(typeof block.type, `${path}: type is a string`).toBe("string");
  expect(isRecord(block.props), `${path}: props is present`).toBe(true);
  expect(Array.isArray(block.content), `${path}: content is an array`).toBe(true);
  for (const [i, runRaw] of (block.content as unknown[]).entries()) {
    const runPath = `${path}.content[${i}]`;
    expect(isRecord(runRaw), `${runPath}: run is an object`).toBe(true);
    const run = runRaw as Run;
    expect(run.type, `${runPath}: run type`).toBe("text");
    expect(typeof run.text, `${runPath}: run text is a string`).toBe("string");
    // BlockNote 0.28 crashes on runs without a styles object.
    expect(isRecord(run.styles), `${runPath}: run styles is present`).toBe(true);
  }
  expect(Array.isArray(block.children), `${path}: children is an array`).toBe(true);
  for (const [i, child] of (block.children as unknown[]).entries()) {
    assertValidBlock(child, `${path}.children[${i}]`);
  }
}

describe("TEMPLATES", () => {
  it("has 4-6 templates including a Blank default", () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(4);
    expect(TEMPLATES.length).toBeLessThanOrEqual(6);
    const blank = TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID);
    expect(blank?.name).toBe("Blank");
  });

  it("has unique ids and non-empty metadata", () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TEMPLATES) {
      expect(t.name.trim()).not.toBe("");
      expect(t.description.trim()).not.toBe("");
      expect(t.icon.trim()).not.toBe("");
    }
  });

  it.each(TEMPLATES.map((t) => [t.id, t] as const))(
    "%s builds a non-empty title and valid blocks",
    (_id, template) => {
      const { title, content } = template.build();
      expect(title.trim()).not.toBe("");
      expect(Array.isArray(content)).toBe(true);
      for (const [i, block] of content.entries()) {
        assertValidBlock(block, `${template.id}[${i}]`);
      }
    }
  );

  it.each(TEMPLATES.map((t) => [t.id, t] as const))(
    "%s serializes to JSON (storable as note content)",
    (_id, template) => {
      const { content } = template.build();
      expect(() => JSON.stringify(content)).not.toThrow();
    }
  );
});

describe("getTemplate / applyTemplate", () => {
  it("looks up templates by id", () => {
    expect(getTemplate("meeting")?.name).toBe("Meeting notes");
    expect(getTemplate("nope")).toBeUndefined();
  });

  it("applies a known template", () => {
    const { title, content } = applyTemplate("weekly-review");
    expect(title).toBe("Weekly review");
    expect((content as Block[]).length).toBeGreaterThan(0);
    const types = (content as Block[]).map((b) => b.type);
    expect(types).toContain("heading");
    expect(types).toContain("checkListItem");
  });

  it("falls back to the blank template for unknown ids", () => {
    expect(applyTemplate("does-not-exist")).toEqual({ title: "Untitled", content: [] });
    expect(applyTemplate("")).toEqual({ title: "Untitled", content: [] });
  });
});
