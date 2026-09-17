import type { Note } from "@/db/schema";

/**
 * Export engine (Phase 4).
 *
 * Pure, unit-testable functions — no React, no Dexie, no browser APIs
 * (except `downloadFile`, which guards itself for SSR). Converts BlockNote
 * documents to GitHub-flavored-ish Markdown and notes/vaults to JSON.
 * Everything is defensive: malformed content yields an empty body, never a throw.
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface RunStyles {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
  link?: string;
  [key: string]: unknown;
}

interface TextRun {
  type?: string;
  text?: string;
  href?: string;
  content?: unknown;
  styles?: RunStyles;
  [key: string]: unknown;
}

interface Block {
  id?: string;
  type?: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: unknown;
  [key: string]: unknown;
}

export interface MarkdownOptions {
  /** Title of the parent note, included in frontmatter when given. */
  parentTitle?: string;
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isBlock(v: unknown): v is Block {
  return isRecord(v);
}

/** "My Note: Draft!" -> "my-note-draft". Fallback "untitled". */
export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return slug || "untitled";
}

function iso(ts: number): string {
  try {
    return new Date(ts).toISOString();
  } catch {
    return new Date(0).toISOString();
  }
}

function yamlQuote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/* ------------------------------------------------------------------ */
/* Inline runs                                                         */
/* ------------------------------------------------------------------ */

function renderCode(text: string): string {
  const fences = (text.match(/`/g) ?? []).length;
  const tick = fences > 0 ? "`".repeat(Math.max(fences + 1, 3)) : "`";
  const pad = fences > 0 && !text.startsWith(" ") && !text.endsWith(" ") ? " " : "";
  return `${tick}${pad}${text}${pad}${tick}`;
}

function renderRun(run: TextRun): string {
  // Native link inline content ({type:"link", href, content:[runs]}).
  if (run.type === "link") {
    const inner = Array.isArray(run.content)
      ? (run.content as TextRun[]).map((r) => renderRun(r)).join("")
      : "";
    const href = typeof run.href === "string" ? run.href : "";
    if (href.startsWith("synapse:")) {
      let title = href.slice("synapse:".length).trim();
      try {
        title = decodeURIComponent(title);
      } catch {
        /* keep the raw title */
      }
      return `[[${title}]]`;
    }
    return href ? `[${inner}](${href})` : inner;
  }

  const raw = typeof run.text === "string" ? run.text : "";
  let text = raw;
  const styles = isRecord(run.styles) ? run.styles : undefined;

  // Legacy wiki-link pseudo-styles: normalize synapse:Title hrefs back to [[Title]].
  if (styles && typeof styles.link === "string" && styles.link.startsWith("synapse:")) {
    text = `[[${styles.link.slice("synapse:".length).trim()}]]`;
  } else if (styles && typeof styles.link === "string" && styles.link) {
    text = `[${text}](${styles.link})`;
  } else if (text.includes("[[")) {
    // Plain-text wiki-link runs stay as-is.
  }

  if (!styles) return text;
  if (styles.code) return renderCode(text);
  // Keep edge whitespace outside the emphasis markers: "*Some *" breaks.
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
  if (m && (styles.bold || styles.italic || styles.strike)) {
    const [, lead, core, trail] = m;
    if (!core) return text;
    let coreText = core;
    if (styles.bold) coreText = `**${coreText}**`;
    if (styles.italic) coreText = `*${coreText}*`;
    if (styles.strike) coreText = `~~${coreText}~~`;
    return `${lead}${coreText}${trail}`;
  }
  if (styles.bold) text = `**${text}**`;
  if (styles.italic) text = `*${text}*`;
  if (styles.strike) text = `~~${text}~~`;
  return text;
}

/** Flatten a block's inline content (runs or bare string) to Markdown. */
function inlineMarkdown(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((run) => (isBlock(run) ? renderRun(run as TextRun) : ""))
    .join("");
}

/* ------------------------------------------------------------------ */
/* Blocks -> Markdown                                                  */
/* ------------------------------------------------------------------ */

function quoteLines(text: string, prefix: string): string {
  if (!text) return prefix.trimEnd();
  return text
    .split("\n")
    .map((line) => `${prefix}${line}`.trimEnd())
    .join("\n");
}

function renderTable(block: Block): string[] {
  // BlockNote tables: { type: "table", content: [{ type: "tableRow",
  // content: [{ type: "tableCell", content: [runs] }] }] }
  const rows = Array.isArray(block.content) ? block.content.filter(isBlock) : [];
  const cellText = (cell: unknown): string => {
    if (!isBlock(cell)) return "";
    return inlineMarkdown(cell.content).replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
  };
  const matrix = rows
    .map((row) => (Array.isArray(row.content) ? row.content.filter(isBlock).map(cellText) : []))
    .filter((r) => r.length > 0);
  if (matrix.length === 0) return [];

  const width = Math.max(...matrix.map((r) => r.length));
  const pad = (cells: string[]) =>
    Array.from({ length: width }, (_, i) => cells[i] ?? "").join(" | ");
  const header = matrix[0];
  const sep = Array.from({ length: width }, () => "---").join(" | ");
  const body = matrix.slice(1);
  const out = [`| ${pad(header)} |`, `| ${sep} |`];
  for (const row of body) out.push(`| ${pad(row)} |`);
  return out;
}

interface Chunk {
  text: string;
  /** Tight chunks (list items, tables) join with "\n" instead of "\n\n". */
  tight: boolean;
}

function renderBlocks(blocks: Block[], indent: string): Chunk[] {
  const out: Chunk[] = [];
  let numberedIndex = 0;

  for (const block of blocks) {
    const type = typeof block.type === "string" ? block.type : "paragraph";
    const props = isRecord(block.props) ? block.props : {};
    const text = inlineMarkdown(block.content);
    const childIndent = `${indent}  `;
    const children = Array.isArray(block.children)
      ? block.children.filter(isBlock)
      : [];

    switch (type) {
      case "heading": {
        const level = typeof props.level === "number" ? Math.min(Math.max(props.level, 1), 3) : 1;
        const hashes = "#".repeat(level);
        out.push({ text: text ? `${hashes} ${text}` : hashes, tight: false });
        numberedIndex = 0;
        break;
      }
      case "bulletListItem":
        out.push({ text: text ? `${indent}- ${text}` : `${indent}-`, tight: true });
        numberedIndex = 0;
        break;
      case "numberedListItem":
        numberedIndex += 1;
        out.push({
          text: text ? `${indent}${numberedIndex}. ${text}` : `${indent}${numberedIndex}.`,
          tight: true,
        });
        break;
      case "checkListItem": {
        const checked = props.checked === true;
        const box = `- [${checked ? "x" : " "}]`;
        out.push({ text: text ? `${indent}${box} ${text}` : `${indent}${box}`, tight: true });
        numberedIndex = 0;
        break;
      }
      case "codeBlock": {
        const lang = typeof props.language === "string" ? props.language : "";
        const code = typeof block.content === "string" ? block.content : text;
        out.push({ text: `\`\`\`${lang}\n${code}\n\`\`\``, tight: false });
        numberedIndex = 0;
        break;
      }
      case "quote":
        out.push({ text: quoteLines(text, `${indent}> `), tight: false });
        numberedIndex = 0;
        break;
      case "divider":
        out.push({ text: `${indent}---`, tight: false });
        numberedIndex = 0;
        break;
      case "callout": {
        const icon = typeof props.icon === "string" && props.icon ? props.icon : "💡";
        out.push({ text: quoteLines(text, `${indent}> ${icon} `), tight: false });
        numberedIndex = 0;
        break;
      }
      case "table": {
        const table = renderTable(block);
        if (table.length) out.push({ text: table.join("\n"), tight: true });
        numberedIndex = 0;
        break;
      }
      case "paragraph":
      default:
        out.push({ text, tight: false });
        numberedIndex = 0;
        break;
    }

    if (children.length) out.push(...renderBlocks(children, childIndent));
  }

  return out;
}

/** Join chunks: two tight neighbors (list items, tables) get a single newline. */
function joinChunks(chunks: Chunk[]): string {
  let result = "";
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) {
      const prev = chunks[i - 1];
      const next = chunks[i];
      result += prev.tight && next.tight ? "\n" : "\n\n";
    }
    result += chunks[i].text;
  }
  return result;
}

/** Convert any supported content shape into a Markdown body. Never throws. */
function contentToMarkdown(content: unknown): string {
  if (typeof content === "string") {
    // Legacy Phase 1 notes: plain text, one paragraph per line group.
    return content
      .split(/\n{2,}/)
      .map((para) => para.trim())
      .filter(Boolean)
      .join("\n\n");
  }
  if (!Array.isArray(content)) return "";
  try {
    return joinChunks(renderBlocks(content.filter(isBlock), "")).trim();
  } catch {
    return "";
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/** One note -> Markdown file content (YAML frontmatter + body). */
export function noteToMarkdown(note: Note, options: MarkdownOptions = {}): string {
  const lines = ["---", `title: ${yamlQuote(note.title || "Untitled")}`];
  if (note.tags.length) {
    lines.push(`tags: [${note.tags.map((t) => yamlQuote(t)).join(", ")}]`);
  } else {
    lines.push("tags: []");
  }
  lines.push(`created: ${yamlQuote(iso(note.createdAt))}`);
  lines.push(`updated: ${yamlQuote(iso(note.updatedAt))}`);
  if (options.parentTitle) lines.push(`parent: ${yamlQuote(options.parentTitle)}`);
  lines.push("---", "");

  const body = contentToMarkdown(note.content);
  return body ? `${lines.join("\n")}\n${body}\n` : `${lines.join("\n")}\n`;
}

/** One note -> pretty-printed JSON of the raw record. */
export function noteToJson(note: Note): string {
  return JSON.stringify(note, null, 2);
}

/** All notes -> pretty-printed JSON array. */
export function vaultToJson(notes: Note[]): string {
  return JSON.stringify(notes, null, 2);
}

/**
 * Whole vault -> one Markdown file. Each note becomes an H1 section
 * (`# Title` + body), sections separated by `---` horizontal rules.
 */
export function vaultToMarkdown(notes: Note[]): string {
  const sections = notes
    .map((note) => {
      const title = note.title || "Untitled";
      const body = contentToMarkdown(note.content);
      return body ? `# ${title}\n\n${body}` : `# ${title}`;
    })
    .join("\n\n---\n\n");
  return `${sections}\n`;
}

/** Trigger a browser download. No-op outside the browser. */
export function downloadFile(
  filename: string,
  content: string,
  mime = "text/plain;charset=utf-8"
): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
