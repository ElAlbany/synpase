import type { PartialBlock } from "@blocknote/core";

/**
 * Normalizes stored blocks before BlockNote sees them. Legacy docs (plain
 * strings, `{type:"paragraph", content:"text"}`) and runs saved without a
 * `styles` object crash BlockNote 0.28's `Object.entries(styledText.styles)`.
 * An early version of the wiki-link engine also stored links as a
 * `styles.link` pseudo-style, which BlockNote rejects with
 * "style link not found in styleSchema" — those runs are migrated to native
 * link inline content here, so old notes self-heal on open.
 */

const VALID_STYLES = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "textColor",
  "backgroundColor",
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Strips style keys BlockNote's default schema doesn't know (e.g. legacy `link`). */
function cleanStyles(styles: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(styles)) {
    if (VALID_STYLES.has(key) && typeof value !== "undefined") out[key] = value;
  }
  return out;
}

interface RunShape {
  type?: string;
  text?: string;
  href?: unknown;
  styles?: unknown;
  content?: unknown;
  [key: string]: unknown;
}

function sanitizeRun(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  const run = raw as RunShape;

  // Legacy wiki-link pseudo-style → native link inline content.
  if (
    run.type === "text" &&
    typeof run.text === "string" &&
    isRecord(run.styles) &&
    typeof run.styles.link === "string" &&
    run.styles.link.startsWith("synapse:")
  ) {
    const { link, ...rest } = run.styles;
    return {
      type: "link",
      href: link,
      content: [
        { type: "text", text: run.text, styles: cleanStyles(rest) },
      ],
    };
  }

  if (run.type === "text") {
    return {
      ...run,
      styles: isRecord(run.styles) ? cleanStyles(run.styles) : {},
    };
  }

  // Native/external link runs: sanitize their inner content recursively.
  if (run.type === "link" && Array.isArray(run.content)) {
    return {
      ...run,
      href: typeof run.href === "string" ? run.href : "",
      content: run.content.map(sanitizeRun),
    };
  }

  return run;
}

export function sanitizeBlocks(blocks: unknown[]): PartialBlock[] {
  return blocks.map((raw) => {
    if (!isRecord(raw)) return raw as PartialBlock;
    const block: Record<string, unknown> = { ...raw };
    if (!isRecord(block.props)) block.props = {};
    if (typeof block.content === "string") {
      block.content = block.content
        ? [{ type: "text", text: block.content, styles: {} }]
        : [];
    } else if (Array.isArray(block.content)) {
      block.content = block.content.map(sanitizeRun);
    }
    if (Array.isArray(block.children)) {
      block.children = sanitizeBlocks(block.children);
    }
    return block as PartialBlock;
  });
}
