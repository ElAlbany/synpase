import type { Note } from "@/db/schema";

/**
 * Wiki-link engine.
 *
 * Links are plain text — [[Some title]] — so they survive any editor. On save,
 * `transformWikiLinks` upgrades them into real BlockNote link marks with
 * `synapse:<title>` hrefs (clickable + styled). `blocksToText` flattens any
 * document shape back to plain text for search, excerpts and backlink scanning.
 */

export const WIKILINK_RE = /\[\[(.+?)\]\]/g;

export function extractWikiLinks(text: string): string[] {
  const out: string[] = [];
  const re = new RegExp(WIKILINK_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const t = m[1].trim();
    if (t) out.push(t);
  }
  return out;
}

interface BlockLike {
  type?: string;
  text?: string;
  content?: unknown;
  children?: unknown;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Flatten any BlockNote document (or plain string) into searchable text. */
export function blocksToText(blocks: unknown): string {
  if (typeof blocks === "string") return blocks;
  if (!Array.isArray(blocks)) return "";

  const parts: string[] = [];
  const walk = (arr: unknown[]) => {
    for (const raw of arr) {
      if (!isRecord(raw)) continue;
      const block = raw as BlockLike;
      if (Array.isArray(block.content)) {
        for (const run of block.content) {
          if (isRecord(run) && typeof run.text === "string") parts.push(run.text);
        }
      } else if (typeof block.content === "string") {
        parts.push(block.content);
      }
      if (Array.isArray(block.children)) walk(block.children);
    }
  };
  walk(blocks);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Split text runs containing [[links]] into plain runs + link-marked runs,
 * recursively through nested blocks. Returns blocks safe to store.
 */
export function transformWikiLinks(blocks: unknown): unknown {
  if (!Array.isArray(blocks)) return blocks;
  return blocks.map((raw) => {
    if (!isRecord(raw)) return raw;
    const block: Record<string, unknown> = { ...raw };
    if (Array.isArray(block.content)) {
      block.content = transformRuns(block.content);
    }
    if (Array.isArray(block.children)) {
      block.children = transformWikiLinks(block.children);
    }
    return block;
  });
}

function transformRuns(runs: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const raw of runs) {
    if (!isRecord(raw)) {
      out.push(raw);
      continue;
    }
    const run = raw as Record<string, unknown>;
    if (run.type !== "text" || typeof run.text !== "string" || !run.text.includes("[[")) {
      out.push(raw);
      continue;
    }
    const text = run.text;
    const re = new RegExp(WIKILINK_RE.source, "g");
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push({ ...run, text: text.slice(last, m.index) });
      out.push({
        ...run,
        text: m[0],
        styles: {
          ...(isRecord(run.styles) ? run.styles : {}),
          link: `synapse:${m[1].trim()}`,
        },
      });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ ...run, text: text.slice(last) });
  }
  return out;
}

export interface Backlink {
  note: Note;
  context: string | null;
}

/** Context window around the first [[title]] mention, for the backlinks panel. */
export function contextAround(text: string, title: string, radius = 60): string | null {
  const idx = text.toLowerCase().indexOf(`[[${title.toLowerCase()}]]`);
  if (idx === -1) return null;
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + title.length + 4 + radius);
  const slice = text.slice(start, end).trim();
  return `${start > 0 ? "…" : ""}${slice}${end < text.length ? "…" : ""}`;
}

/** Every note that references `target` via [[target.title]] (case-insensitive). */
export function getBacklinks(notes: Note[], target: Note): Backlink[] {
  const title = target.title.trim();
  if (!title) return [];
  const out: Backlink[] = [];
  for (const note of notes) {
    if (note.id === target.id) continue;
    const text = blocksToText(note.content);
    if (text.toLowerCase().includes(`[[${title.toLowerCase()}]]`)) {
      out.push({ note, context: contextAround(text, title) });
    }
  }
  // most recently edited first
  return out.sort((a, b) => b.note.updatedAt - a.note.updatedAt);
}
