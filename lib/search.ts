import MiniSearch, { type SearchResult } from "minisearch";
import type { Note } from "@/db/schema";
import { blocksToText } from "@/lib/wikilinks";

/**
 * Client-side full-text search over notes, built on MiniSearch.
 *
 * Pure and synchronous — no Dexie imports here, so everything is unit-testable
 * with plain `Note` objects. Pages own the live-query wiring.
 *
 * Highlighting: `highlightQuery` returns React-safe segments (never HTML), so
 * callers render them directly as `<mark>`-styled spans — no `dangerouslySetInnerHTML`.
 */

export interface NotesSearchDocument {
  id: string;
  title: string;
  /** Flattened plain text via blocksToText. */
  text: string;
  tags: string[];
  updatedAt: number;
  parentId: string | null;
}

export interface NotesSearchResult {
  id: string;
  title: string;
  /** Flattened plain text of the note — used for match excerpts. */
  text: string;
  tags: string[];
  updatedAt: number;
  parentId: string | null;
  score: number;
  /** Document terms that matched (resolved, e.g. prefix matches). */
  terms: string[];
}

export interface SearchNotesOptions {
  /** Multi-select tag filter: keep only results carrying at least one. */
  tags?: string[];
  limit?: number;
}

/** Build a fresh index over `notes`. Cheap enough to rebuild on every change. */
export function createNotesIndex(
  notes: Note[]
): MiniSearch<NotesSearchDocument> {
  const index = new MiniSearch<NotesSearchDocument>({
    fields: ["title", "text"],
    storeFields: ["title", "text", "tags", "updatedAt", "parentId"],
    searchOptions: {
      boost: { title: 3 },
      // prefix-match once the term has a couple of characters ("graph" finds "graphite")
      prefix: (term) => term.length >= 2,
      fuzzy: 0.1,
    },
  });

  index.addAll(
    notes.map((note) => ({
      id: note.id,
      title: note.title,
      text: blocksToText(note.content),
      tags: note.tags,
      updatedAt: note.updatedAt,
      parentId: note.parentId,
    }))
  );

  return index;
}

/** Run `query` against the index. Empty query returns nothing. */
export function searchNotes(
  index: MiniSearch<NotesSearchDocument> | null,
  query: string,
  opts: SearchNotesOptions = {}
): NotesSearchResult[] {
  if (!index || !query.trim()) return [];

  let raw = index.search(query) as SearchResult[];

  if (opts.tags && opts.tags.length > 0) {
    const wanted = new Set(opts.tags);
    raw = raw.filter((r) =>
      (r.tags as string[] | undefined)?.some((t) => wanted.has(t))
    );
  }

  const results: NotesSearchResult[] = raw.map((r) => ({
    id: String(r.id),
    title: (r.title as string) ?? "",
    text: (r.text as string) ?? "",
    tags: (r.tags as string[] | undefined) ?? [],
    updatedAt: (r.updatedAt as number) ?? 0,
    parentId: (r.parentId as string | null) ?? null,
    score: r.score,
    terms: r.terms ?? [],
  }));

  return opts.limit ? results.slice(0, opts.limit) : results;
}

export interface HighlightSegment {
  text: string;
  match: boolean;
}

/**
 * Split `text` into React-safe segments, flagging runs that match any of the
 * resolved query terms (case-insensitive, substring-level so prefix matches
 * highlight too). Render `match: true` segments inside a styled <mark>-like span.
 */
export function highlightQuery(text: string, terms: string[]): HighlightSegment[] {
  const clean = terms.map((t) => t.trim()).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!text || clean.length === 0) return text ? [{ text, match: false }] : [];

  const escaped = clean.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "gi");

  const segments: HighlightSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) segments.push({ text: text.slice(last, m.index), match: false });
    segments.push({ text: m[0], match: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), match: false });
  return segments;
}

/**
 * Excerpt (~maxChars) centered on the first query-term match, with ellipsis
 * markers. Falls back to a head-truncate when nothing matches.
 */
export function excerptAround(
  text: string,
  terms: string[],
  maxChars = 160
): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;

  const lower = clean.toLowerCase();
  let hit = -1;
  for (const term of terms) {
    const idx = lower.indexOf(term.toLowerCase());
    if (idx !== -1 && (hit === -1 || idx < hit)) hit = idx;
  }

  const start = hit === -1 ? 0 : Math.max(0, hit - Math.floor(maxChars / 3));
  const end = Math.min(clean.length, start + maxChars);
  const slice = clean.slice(start, end).trim();
  return `${start > 0 ? "…" : ""}${slice}${end < clean.length ? "…" : ""}`;
}
