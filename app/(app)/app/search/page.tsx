"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { formatDistanceToNow } from "date-fns";
import { Plus, Search, SearchX } from "lucide-react";
import { db } from "@/db";
import type { Note } from "@/db/schema";
import {
  createNotesIndex,
  excerptAround,
  highlightQuery,
  searchNotes,
  type HighlightSegment,
  type NotesSearchResult,
} from "@/lib/search";
import { tagColor } from "@/lib/tree";
import { useNotesStore } from "@/stores/useNotesStore";

export default function SearchPage() {
  const router = useRouter();
  const notes = useLiveQuery(() => db.notes.toArray(), []);
  const { createNote } = useNotesStore();

  const [query, setQuery] = React.useState("");
  const [activeTags, setActiveTags] = React.useState<string[]>([]);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const index = React.useMemo(
    () => (notes ? createNotesIndex(notes) : null),
    [notes]
  );

  const allTags = React.useMemo(
    () => [...new Set((notes ?? []).flatMap((n) => n.tags))].sort(),
    [notes]
  );

  const titleById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const n of notes ?? []) map.set(n.id, n.title || "Untitled");
    return map;
  }, [notes]);

  const isSearching = query.trim().length > 0;
  const tagFilter = activeTags.length > 0 ? activeTags : undefined;

  const results = React.useMemo(
    () => searchNotes(index, query, { tags: tagFilter }),
    [index, query, tagFilter]
  );

  const suggestions = React.useMemo(() => {
    const pool = tagFilter
      ? (notes ?? []).filter((n) => n.tags.some((t) => activeTags.includes(t)))
      : (notes ?? []);
    return [...pool].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);
  }, [notes, tagFilter, activeTags]);

  const shown: Array<Note | NotesSearchResult> = isSearching
    ? results
    : suggestions;

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query, activeTags]);

  // auto-focus on mount; refocus after Escape clears
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const openNote = React.useCallback(
    (id: string) => router.push(`/app/note/${id}`),
    [router]
  );

  const handleCreate = async () => {
    const note = await createNote();
    router.push(`/app/note/${note.id}`);
  };

  const toggleTag = (tag: string) =>
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = shown[Math.min(activeIndex, shown.length - 1)];
      if (target) openNote(target.id);
    } else if (e.key === "Escape") {
      setQuery("");
      inputRef.current?.blur();
    }
  };

  if (!notes) {
    return (
      <div className="grid h-full place-items-center text-sm text-faint">
        Loading your workspace…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      {/* search input */}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-faint" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search notes…"
          aria-label="Search notes"
          role="combobox"
          aria-expanded="true"
          aria-controls="search-results"
          className="w-full rounded-[10px] border border-line bg-raised py-3.5 pr-4 pl-12 text-lg text-ink shadow-sm outline-none transition-colors duration-150 placeholder:text-faint/60 focus:border-accent/50"
        />
      </div>

      {/* hint bar */}
      <div className="mt-3 flex items-center gap-4 text-[11px] text-faint">
        <span className="flex items-center gap-1.5">
          <kbd className="kbd">↑↓</kbd> navigate
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="kbd">↵</kbd> open
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="kbd">esc</kbd> clear
        </span>
        <span className="flex-1" />
        {isSearching && (
          <span>
            {results.length} result{results.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {/* tag filter chips */}
      {allTags.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {allTags.map((tag) => {
            const active = activeTags.includes(tag);
            const color = tagColor(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                aria-pressed={active}
                className="rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150"
                style={
                  active
                    ? {
                        color,
                        borderColor: `${color}66`,
                        backgroundColor: `${color}22`,
                      }
                    : {
                        color,
                        borderColor: `${color}33`,
                        backgroundColor: `${color}10`,
                      }
                }
              >
                #{tag}
              </button>
            );
          })}
        </div>
      )}

      {/* results / suggestions */}
      <div id="search-results" role="listbox" aria-label="Search results">
        {!isSearching && (
          <h2 className="mt-10 mb-3 text-sm font-semibold tracking-wide text-faint uppercase">
            Recently edited
          </h2>
        )}

        {shown.length === 0 ? (
          <NoResults
            hasQuery={isSearching}
            onCreate={handleCreate}
            onClearTags={
              activeTags.length > 0 ? () => setActiveTags([]) : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {isSearching
              ? results.map((r, i) => (
                  <ResultCard
                    key={r.id}
                    result={r}
                    parentTitle={
                      r.parentId ? (titleById.get(r.parentId) ?? null) : null
                    }
                    active={i === activeIndex}
                    onOpen={() => openNote(r.id)}
                    onMouseEnter={() => setActiveIndex(i)}
                  />
                ))
              : suggestions.map((n, i) => (
                  <SuggestionCard
                    key={n.id}
                    note={n}
                    parentTitle={
                      n.parentId ? (titleById.get(n.parentId) ?? null) : null
                    }
                    active={i === activeIndex}
                    onOpen={() => openNote(n.id)}
                    onMouseEnter={() => setActiveIndex(i)}
                  />
                ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Highlighted({ segments }: { segments: HighlightSegment[] }) {
  return (
    <>
      {segments.map((s, i) =>
        s.match ? (
          <mark
            key={i}
            className="rounded-[3px] bg-accent/25 px-0.5 text-inherit"
          >
            {s.text}
          </mark>
        ) : (
          <React.Fragment key={i}>{s.text}</React.Fragment>
        )
      )}
    </>
  );
}

function TagPills({ tags }: { tags: string[] }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span
          key={t}
          className="rounded-full px-2 py-0.5 text-[10.5px] font-medium"
          style={{
            color: tagColor(t),
            backgroundColor: `${tagColor(t)}18`,
          }}
        >
          #{t}
        </span>
      ))}
    </span>
  );
}

function ResultCard({
  result,
  parentTitle,
  active,
  onOpen,
  onMouseEnter,
}: {
  result: NotesSearchResult;
  parentTitle: string | null;
  active: boolean;
  onOpen: () => void;
  onMouseEnter: () => void;
}) {
  const excerpt = excerptAround(result.text, result.terms, 160);
  return (
    <button
      onClick={onOpen}
      onMouseEnter={onMouseEnter}
      role="option"
      aria-selected={active}
      className={`w-full rounded-[10px] border p-4 text-left transition-all duration-150 ${
        active
          ? "border-accent/40 bg-overlay"
          : "border-line bg-raised hover:bg-overlay"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 truncate text-[15px] font-semibold">
          <Highlighted
            segments={highlightQuery(result.title || "Untitled", result.terms)}
          />
        </span>
        <span className="flex-none text-[11px] text-faint">
          {formatDistanceToNow(result.updatedAt, { addSuffix: true })}
        </span>
      </div>
      {excerpt && (
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-mute">
          <Highlighted segments={highlightQuery(excerpt, result.terms)} />
        </p>
      )}
      <div className="mt-2.5 flex items-center gap-2">
        {parentTitle && (
          <span className="truncate text-[11px] text-faint">
            {parentTitle} <span className="text-faint/60">/</span>
          </span>
        )}
        <span className="flex-1" />
        <TagPills tags={result.tags} />
      </div>
    </button>
  );
}

function SuggestionCard({
  note,
  parentTitle,
  active,
  onOpen,
  onMouseEnter,
}: {
  note: Note;
  parentTitle: string | null;
  active: boolean;
  onOpen: () => void;
  onMouseEnter: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      onMouseEnter={onMouseEnter}
      role="option"
      aria-selected={active}
      className={`w-full rounded-[10px] border p-4 text-left transition-all duration-150 ${
        active
          ? "border-accent/40 bg-overlay"
          : "border-line bg-raised hover:bg-overlay"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 truncate text-[15px] font-semibold">
          {note.title || "Untitled"}
        </span>
        <span className="flex-none text-[11px] text-faint">
          {formatDistanceToNow(note.updatedAt, { addSuffix: true })}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        {parentTitle && (
          <span className="truncate text-[11px] text-faint">
            {parentTitle} <span className="text-faint/60">/</span>
          </span>
        )}
        <span className="flex-1" />
        <TagPills tags={note.tags} />
      </div>
    </button>
  );
}

function NoResults({
  hasQuery,
  onCreate,
  onClearTags,
}: {
  hasQuery: boolean;
  onCreate: () => void;
  onClearTags?: () => void;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-line bg-raised p-10 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-line bg-overlay">
        <SearchX className="size-6 text-faint" />
      </div>
      <h2 className="mt-5 text-lg font-semibold">
        {hasQuery ? "No matching notes" : "Nothing here yet"}
      </h2>
      <p className="mt-1.5 text-sm text-mute">
        {hasQuery
          ? "Try different keywords, or clear the tag filters."
          : "Create a note and it will show up here."}
      </p>
      <div className="mt-5 flex justify-center gap-2.5">
        {onClearTags && (
          <button
            onClick={onClearTags}
            className="rounded-[10px] border border-line bg-overlay px-4 py-2 text-sm font-medium transition-colors duration-150 hover:border-line-strong"
          >
            Clear tag filters
          </button>
        )}
        <button
          onClick={onCreate}
          className="flex items-center gap-2 rounded-[10px] bg-aurora px-4 py-2 text-sm font-medium text-white transition-transform duration-200 [transition-timing-function:cubic-bezier(.16,1,.3,1)] hover:-translate-y-0.5"
        >
          <Plus className="size-4" /> Create note
        </button>
      </div>
    </div>
  );
}
