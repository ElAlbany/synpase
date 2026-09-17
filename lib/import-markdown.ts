/**
 * Markdown import (stretch goal).
 *
 * Converts Markdown text into BlockNote partial blocks. Defensive by design:
 * malformed Markdown degrades to paragraphs, never throws. The single
 * deliberate failure mode is the 2 MB input cap, which rejects with a typed
 * MarkdownImportError carrying a human-readable message.
 *
 * Input is a local user file treated as hostile: no eval, no HTML, no
 * escaping needed — BlockNote stores plain text and escapes at render time.
 * [[wiki-links]] are preserved as plain-text runs; the app's
 * transformWikiLinks upgrades them to real links on save. [text](url) links
 * become native link inline content, and only safe URL schemes are linked.
 */

export const MAX_MARKDOWN_BYTES = 2 * 1024 * 1024;

export class MarkdownImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarkdownImportError";
  }
}

/* ------------------------------------------------------------------ */
/* Shapes                                                              */
/* ------------------------------------------------------------------ */

interface Run {
  type: "text";
  text: string;
  styles: Record<string, unknown>;
}

/** BlockNote native link inline content — not a style, a wrapper node. */
interface LinkRun {
  type: "link";
  href: string;
  content: Run[];
}

type InlineContent = Run | LinkRun;

interface Block {
  type: string;
  props: Record<string, unknown>;
  content: InlineContent[];
  children: Block[];
}

function run(text: string, styles: Record<string, unknown> = {}): Run {
  return { type: "text", text, styles };
}

function makeBlock(
  type: string,
  content: InlineContent[],
  props: Record<string, unknown> = {},
  children: Block[] = []
): Block {
  return { type, props, content, children };
}

/** Only these URL schemes become clickable links; anything else degrades to text. */
const SAFE_HREF_RE = /^(https?:|mailto:|#|\/)/i;

/* ------------------------------------------------------------------ */
/* Input hygiene                                                       */
/* ------------------------------------------------------------------ */

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

function checkSize(md: string): void {
  const size = byteLength(md);
  if (size > MAX_MARKDOWN_BYTES) {
    throw new MarkdownImportError(
      `File is too large (${(size / 1024 / 1024).toFixed(1)} MB). Maximum is 2 MB.`
    );
  }
}

/** Strip NUL bytes and normalize CRLF/CR to LF. */
function normalize(md: string): string {
  return md.replace(/\0/g, "").replace(/\r\n?/g, "\n");
}

/* ------------------------------------------------------------------ */
/* Inline runs: `code`, [link](url), [[wiki]], **bold**, *italic*      */
/* ------------------------------------------------------------------ */

const INLINE_RE =
  /(`[^`\n]+`)|(\[\[[^\]\n]+\]\])|(\[[^\]\n]*\]\([^()\n]*\))|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(__[^_\n]+__)|(_[^_\n]+_)/g;

const LINK_RE = /^\[([^\]]*)\]\(([^)]*)\)$/;

export function parseInline(text: string): InlineContent[] {
  const runs: InlineContent[] = [];
  let last = 0;
  INLINE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) runs.push(run(text.slice(last, m.index)));
    const [full, code, wiki, link, boldStar, italicStar, boldUnder, italicUnder] = m;
    if (code !== undefined) {
      runs.push(run(code.slice(1, -1), { code: true }));
    } else if (wiki !== undefined) {
      // Kept as a plain-text run; transformWikiLinks upgrades it on save.
      runs.push(run(wiki));
    } else if (link !== undefined) {
      const lm = LINK_RE.exec(link);
      const href = lm ? lm[2].trim() : "";
      // Native link inline content; unsafe schemes (javascript: etc.) degrade
      // to plain text — imported files are treated as hostile input.
      if (lm && href && SAFE_HREF_RE.test(href)) {
        runs.push({ type: "link", href, content: [run(lm[1])] });
      } else {
        runs.push(run(link));
      }
    } else if (boldStar !== undefined) {
      runs.push(run(boldStar.slice(2, -2), { bold: true }));
    } else if (italicStar !== undefined) {
      runs.push(run(italicStar.slice(1, -1), { italic: true }));
    } else if (boldUnder !== undefined) {
      runs.push(run(boldUnder.slice(2, -2), { bold: true }));
    } else if (italicUnder !== undefined) {
      runs.push(run(italicUnder.slice(1, -1), { italic: true }));
    }
    last = m.index + full.length;
  }
  if (last < text.length) runs.push(run(text.slice(last)));
  return runs;
}

/** Rough plain-text version of inline Markdown (for title extraction). */
function inlineToPlain(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();
}

/* ------------------------------------------------------------------ */
/* Block-level parsing                                                 */
/* ------------------------------------------------------------------ */

const FENCE_RE = /^```(\S*)\s*$/;
const DIVIDER_RE = /^(?:-{3,}|\*{3,}|_{3,})$/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const QUOTE_RE = /^>(?:\s?(.*))?$/;
const CHECK_RE = /^(\s*)[-*+]\s+\[( |x|X)\]\s+(.*)$/;
const BULLET_RE = /^(\s*)[-*+]\s+(.*)$/;
const NUMBERED_RE = /^(\s*)\d+[.)]\s+(.*)$/;

type ListKind = "bullet" | "numbered" | "check";

interface ListItem {
  indent: number;
  kind: ListKind;
  checked: boolean;
  text: string;
}

function indentOf(ws: string): number {
  return ws.replace(/\t/g, "  ").length;
}

function isListItem(line: string): boolean {
  return CHECK_RE.test(line) || BULLET_RE.test(line) || NUMBERED_RE.test(line);
}

function parseListItem(line: string): ListItem {
  const c = CHECK_RE.exec(line);
  if (c) {
    return { indent: indentOf(c[1]), kind: "check", checked: c[2].toLowerCase() === "x", text: c[3] };
  }
  const b = BULLET_RE.exec(line);
  if (b) return { indent: indentOf(b[1]), kind: "bullet", checked: false, text: b[2] };
  const n = NUMBERED_RE.exec(line);
  if (n) return { indent: indentOf(n[1]), kind: "numbered", checked: false, text: n[2] };
  return { indent: 0, kind: "bullet", checked: false, text: line.trim() };
}

/** True when the line starts a non-paragraph construct (breaks a paragraph). */
function startsBlock(line: string): boolean {
  const t = line.trim();
  return (
    FENCE_RE.test(t) ||
    DIVIDER_RE.test(t) ||
    HEADING_RE.test(t) ||
    QUOTE_RE.test(t) ||
    isListItem(line)
  );
}

/** Build a nested list tree from consecutive list items via an indent stack. */
function buildList(items: ListItem[]): Block[] {
  const roots: Block[] = [];
  const stack: { indent: number; block: Block }[] = [];
  for (const item of items) {
    const type =
      item.kind === "check"
        ? "checkListItem"
        : item.kind === "numbered"
          ? "numberedListItem"
          : "bulletListItem";
    const props = item.kind === "check" ? { checked: item.checked } : {};
    const block = makeBlock(type, parseInline(item.text.trim()), props);
    while (stack.length && stack[stack.length - 1].indent >= item.indent) stack.pop();
    if (stack.length) stack[stack.length - 1].block.children.push(block);
    else roots.push(block);
    stack.push({ indent: item.indent, block });
  }
  return roots;
}

function parseBlocks(md: string): Block[] {
  const lines = md.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Fenced code block (``` optional-language ... ```). Unclosed fences
    // consume to EOF — defensive, not an error.
    const fence = FENCE_RE.exec(trimmed);
    if (fence) {
      const language = fence[1] ?? "";
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing fence
      blocks.push(
        makeBlock(
          "codeBlock",
          buf.length ? [run(buf.join("\n"))] : [],
          { language }
        )
      );
      continue;
    }

    if (DIVIDER_RE.test(trimmed)) {
      blocks.push(makeBlock("divider", []));
      i++;
      continue;
    }

    const h = HEADING_RE.exec(trimmed);
    if (h) {
      const level = Math.min(h[1].length, 3);
      blocks.push(makeBlock("heading", parseInline(h[2].trim()), { level }));
      i++;
      continue;
    }

    // Blockquote: consecutive > lines become one quote block.
    if (QUOTE_RE.test(trimmed)) {
      const buf: string[] = [];
      while (i < lines.length) {
        const q = QUOTE_RE.exec(lines[i].trim());
        if (!q) break;
        buf.push(q[1] ?? "");
        i++;
      }
      blocks.push(makeBlock("quote", parseInline(buf.join("\n").trim())));
      continue;
    }

    // List run: consecutive list lines (any marker) with indent nesting.
    if (isListItem(line)) {
      const items: ListItem[] = [];
      while (i < lines.length && isListItem(lines[i])) {
        items.push(parseListItem(lines[i]));
        i++;
      }
      blocks.push(...buildList(items));
      continue;
    }

    // Paragraph: consecutive plain lines until blank line or a new construct.
    const buf: string[] = [trimmed];
    i++;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) {
      buf.push(lines[i].trim());
      i++;
    }
    blocks.push(makeBlock("paragraph", parseInline(buf.join("\n"))));
  }

  return blocks;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Markdown -> BlockNote partial blocks. Never throws on malformed input;
 * rejects oversize input with MarkdownImportError.
 */
export function markdownToBlocks(md: string): unknown[] {
  if (typeof md !== "string") return [];
  checkSize(md);
  try {
    return parseBlocks(normalize(md));
  } catch {
    return [];
  }
}

/** First H1's plain text, or null when the document has none. */
function extractTitle(md: string): string | null {
  const m = /^#[ \t]+(.+?)[ \t]*#*[ \t]*$/m.exec(normalize(md));
  if (!m) return null;
  return inlineToPlain(m[1]) || null;
}

/** "notes/Deep Work.md" -> "Deep Work"; empty -> "Untitled". */
function titleFromFilename(filename: string): string {
  const base = (filename || "").split(/[\\/]/).pop() ?? "";
  const noExt = base.replace(/\.(md|markdown|txt)$/i, "");
  return noExt.trim() || "Untitled";
}

/**
 * Markdown + filename -> { title, content } ready for createNote.
 * Title is the document's first H1, else the filename minus extension.
 * Rejects oversize input with MarkdownImportError; never throws otherwise.
 */
export function markdownToNote(
  md: string,
  filename = ""
): { title: string; content: unknown[] } {
  const safe = typeof md === "string" ? md : "";
  checkSize(safe);
  const content = markdownToBlocks(safe);
  const title = extractTitle(safe) ?? titleFromFilename(filename);
  return { title, content };
}
