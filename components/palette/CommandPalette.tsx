"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useTheme } from "next-themes";
import {
  CornerDownLeft,
  FilePlus2,
  FileText,
  House,
  Moon,
  Network,
  Plus,
  Search,
  Sun,
  Tag,
  X,
} from "lucide-react";
import { db } from "@/db";
import { createNote, noteExcerpt } from "@/db/notes";
import { blocksToText } from "@/lib/wikilinks";
import { tagColor } from "@/lib/tree";
import { useUIStore } from "@/stores/useUIStore";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Fuzzy scorer — subsequence match + substring/word bonuses.          */
/* ------------------------------------------------------------------ */

interface FuzzyMatch {
  score: number;
  /** Character indices in `target` that matched, for highlighting. */
  indices: number[];
}

function fuzzyScore(query: string, target: string): FuzzyMatch | null {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase();
  if (!q) return { score: 0, indices: [] };
  if (!t) return null;

  const indices: number[] = [];
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      indices.push(ti);
      qi++;
    }
  }
  if (qi < q.length) return null;

  const first = indices[0];
  const last = indices[indices.length - 1];
  const span = last - first + 1;
  let score = q.length * 4 - span;
  if (span === q.length) score += 24; // contiguous substring
  if (first === 0) score += 16; // prefix match
  else if (/[\s\-_/([{]/.test(t[first - 1] ?? "")) score += 8; // word start
  score -= first * 0.05; // earlier matches rank higher
  return { score, indices };
}

function Highlight({ text, indices }: { text: string; indices?: number[] }) {
  if (!indices || indices.length === 0) return <>{text}</>;
  const hit = new Set(indices);
  const runs: { str: string; hit: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = runs[runs.length - 1];
    if (last && last.hit === hit.has(i)) last.str += text[i];
    else runs.push({ str: text[i], hit: hit.has(i) });
  }
  return (
    <>
      {runs.map((r, i) =>
        r.hit ? (
          <mark key={i} className="bg-transparent font-semibold text-accent-ink">
            {r.str}
          </mark>
        ) : (
          <span key={i}>{r.str}</span>
        )
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Palette items                                                       */
/* ------------------------------------------------------------------ */

type Group = "notes" | "create" | "actions" | "tags";

interface PaletteItem {
  id: string;
  group: Group;
  label: string;
  sub?: string;
  icon: React.ReactNode;
  indices?: number[];
  run: () => void | Promise<void>;
}

const GROUP_LABELS: Record<Group, string> = {
  notes: "Jump to",
  create: "Create",
  actions: "Actions",
  tags: "Tags",
};

const GROUP_ORDER: Group[] = ["notes", "create", "actions", "tags"];

const EASE = "cubic-bezier(.16,1,.3,1)";

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function CommandPalette() {
  const router = useRouter();
  const open = useUIStore((s) => s.paletteOpen);
  const setOpen = useUIStore((s) => s.setPaletteOpen);
  const { resolvedTheme, setTheme } = useTheme();

  const [query, setQuery] = React.useState("");
  const [activeTag, setActiveTag] = React.useState<string | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [closing, setClosing] = React.useState(false);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const restoreFocusRef = React.useRef<Element | null>(null);

  const notes = useLiveQuery(() => db.notes.toArray(), []);
  const loaded = notes !== undefined;

  /* Cmd/Ctrl+K toggles, from anywhere in the app. */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useUIStore.getState().paletteOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  /* Open/close choreography: focus in, restore focus out, exit transition.
     Skip the closing animation on first mount (palette starts closed). */
  const mountedRef = React.useRef(false);
  React.useEffect(() => {
    if (open) {
      mountedRef.current = true;
      restoreFocusRef.current = document.activeElement;
      setClosing(false);
      setQuery("");
      setActiveTag(null);
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (mountedRef.current) {
      setClosing(true);
      const t = setTimeout(() => {
        setClosing(false);
        const el = restoreFocusRef.current;
        if (el instanceof HTMLElement) el.focus();
        restoreFocusRef.current = null;
      }, 180);
      return () => clearTimeout(t);
    }
  }, [open]);

  const close = React.useCallback(() => setOpen(false), [setOpen]);

  const go = React.useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router]
  );

  const makeNote = React.useCallback(
    (input?: Parameters<typeof createNote>[0]) => {
      close();
      void createNote(input).then((n) => router.push(`/app/note/${n.id}`));
    },
    [close, router]
  );

  /* ------------------------- result assembly ------------------------ */

  const items = React.useMemo<PaletteItem[]>(() => {
    if (!notes) return [];
    const q = query.trim();
    const out: PaletteItem[] = [];

    const noteItems: PaletteItem[] = [];
    const actionItems: PaletteItem[] = [];
    const createItems: PaletteItem[] = [];
    const tagItems: PaletteItem[] = [];

    /* --- notes --- */
    const candidates = activeTag
      ? notes.filter((n) => n.tags.includes(activeTag!))
      : notes;

    if (!q) {
      const recent = [...candidates]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 8);
      for (const n of recent) {
        noteItems.push({
          id: `note-${n.id}`,
          group: "notes",
          label: n.title || "Untitled",
          sub: noteExcerpt(n, 80),
          icon: <FileText className="size-4 flex-none" />,
          run: () => go(`/app/note/${n.id}`),
        });
      }
    } else {
      const scored: { item: PaletteItem; score: number }[] = [];
      for (const n of candidates) {
        const title = n.title || "Untitled";
        const titleMatch = fuzzyScore(q, title);
        const text = blocksToText(n.content).slice(0, 300);
        const contentMatch = fuzzyScore(q, text);
        if (!titleMatch && !contentMatch) continue;
        const score =
          (titleMatch ? titleMatch.score * 3 : 0) +
          (contentMatch ? contentMatch.score : 0);
        scored.push({
          score,
          item: {
            id: `note-${n.id}`,
            group: "notes",
            label: title,
            sub: titleMatch ? noteExcerpt(n, 80) : undefined,
            icon: <FileText className="size-4 flex-none" />,
            indices: titleMatch?.indices,
            run: () => go(`/app/note/${n.id}`),
          },
        });
      }
      scored.sort((a, b) => b.score - a.score);
      noteItems.push(...scored.slice(0, 8).map((s) => s.item));
    }

    /* --- tags (a selected tag filters the Jump-to list) --- */
    if (!activeTag && q) {
      const allTags = [...new Set(notes.flatMap((n) => n.tags))];
      const scoredTags = allTags
        .map((tag) => ({ tag, m: fuzzyScore(q, tag) }))
        .filter((s): s is { tag: string; m: FuzzyMatch } => s.m !== null)
        .sort((a, b) => b.m.score - a.m.score)
        .slice(0, 4);
      for (const { tag, m } of scoredTags) {
        const count = notes.filter((n) => n.tags.includes(tag)).length;
        tagItems.push({
          id: `tag-${tag}`,
          group: "tags",
          label: tag,
          sub: `${count} note${count === 1 ? "" : "s"}`,
          icon: <Tag className="size-4 flex-none" />,
          indices: m.indices,
          run: () => {
            setActiveTag(tag);
            setActiveIndex(0);
            inputRef.current?.focus();
          },
        });
      }
    }

    /* --- create --- */
    if (q) {
      createItems.push({
        id: "create-capture",
        group: "create",
        label: `Create note "${q}"`,
        sub: "Capture this text as a new note",
        icon: <Plus className="size-4 flex-none" />,
        run: () => makeNote({ title: q }),
      });
      const exact = notes.some(
        (n) => n.title.trim().toLowerCase() === q.toLowerCase()
      );
      if (!exact) {
        createItems.push({
          id: "create-titled",
          group: "create",
          label: `Create note titled "${q}"`,
          sub: "Start a fresh note with this title",
          icon: <FilePlus2 className="size-4 flex-none" />,
          run: () => makeNote({ title: q }),
        });
      }
    }

    /* --- actions --- */
    const actions: { name: string; keywords: string; icon: React.ReactNode; run: () => void }[] = [
      { name: "Go Home", keywords: "home dashboard", icon: <House className="size-4 flex-none" />, run: () => go("/app") },
      { name: "Go to Graph", keywords: "graph network visual", icon: <Network className="size-4 flex-none" />, run: () => go("/app/graph") },
      { name: "Go to Search", keywords: "search find filter", icon: <Search className="size-4 flex-none" />, run: () => go("/app/search") },
      { name: "New note", keywords: "new create blank", icon: <FilePlus2 className="size-4 flex-none" />, run: () => makeNote() },
      {
        name: "Toggle theme",
        keywords: "theme dark light mode",
        icon: resolvedTheme === "dark" ? <Sun className="size-4 flex-none" /> : <Moon className="size-4 flex-none" />,
        run: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
      },
    ];
    for (const a of actions) {
      const m = q ? fuzzyScore(q, a.name) ?? fuzzyScore(q, a.keywords) : { score: 0, indices: [] as number[] };
      if (!m) continue;
      actionItems.push({
        id: `action-${a.name}`,
        group: "actions",
        label: a.name,
        icon: a.icon,
        indices: m.indices,
        run: () => {
          close();
          a.run();
        },
      });
    }

    out.push(...noteItems, ...createItems, ...actionItems, ...tagItems);
    return out;
  }, [notes, query, activeTag, resolvedTheme, go, makeNote, close, setTheme]);

  /* Keep the cursor inside the list when results change shape. */
  React.useEffect(() => {
    setActiveIndex(0);
  }, [query, activeTag]);

  const flat = items;
  const activeItem = flat[Math.min(activeIndex, flat.length - 1)];

  const runItem = (item: PaletteItem | undefined) => {
    if (!item) return;
    void item.run();
  };

  /* --------------------------- keyboard ---------------------------- */

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (flat.length === 0 ? 0 : (i + 1) % flat.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) =>
        flat.length === 0 ? 0 : (i - 1 + flat.length) % flat.length
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      runItem(activeItem);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (activeTag) setActiveTag(null);
      else if (query) setQuery("");
      else close();
    } else if (e.key === "Tab") {
      // Simple focus trap: keep focus on the combobox while open.
      e.preventDefault();
    }
  };

  if (!open && !closing) return null;

  /* ------------------------------ render ---------------------------- */

  const grouped = GROUP_ORDER.map((g) => ({
    group: g,
    items: flat.filter((i) => i.group === g),
  })).filter((g) => g.items.length > 0);

  let runningIndex = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[10vh] sm:pt-[14vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {/* backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black/45 backdrop-blur-[6px] transition-opacity duration-[240ms]",
          open ? "opacity-100" : "opacity-0"
        )}
        style={{ transitionTimingFunction: EASE }}
        aria-hidden
      />

      {/* panel */}
      <div
        className={cn(
          "relative flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-line bg-raised shadow-2xl transition-all duration-[240ms]",
          open
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-1 scale-[0.97] opacity-0"
        )}
        style={{ transitionTimingFunction: EASE }}
      >
        {/* input row */}
        <div className="flex flex-none items-center gap-2.5 border-b border-line px-4">
          <Search className="size-4 flex-none text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={activeTag ? `Search within #${activeTag}…` : "Search notes, create, actions…"}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-listbox"
            aria-activedescendant={activeItem?.id}
            aria-label="Command palette search"
            className="h-13 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
          />
          {activeTag && (
            <button
              onClick={() => setActiveTag(null)}
              className="flex flex-none items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{
                color: tagColor(activeTag),
                backgroundColor: `${tagColor(activeTag)}18`,
              }}
              title={`Clear tag filter #${activeTag}`}
            >
              #{activeTag}
              <X className="size-3" />
            </button>
          )}
          <kbd className="kbd flex-none">esc</kbd>
        </div>

        {/* results */}
        <div className="flex-1 overflow-y-auto p-2 [scrollbar-width:thin]">
          {!loaded && (
            <div className="px-3 py-8 text-center text-[13px] text-faint">
              Loading…
            </div>
          )}
          {loaded && grouped.length === 0 && (
            <div className="px-3 py-8 text-center text-[13px] text-faint">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
          {grouped.map(({ group, items: groupItems }) => (
            <div key={group} className="mb-1">
              <div className="px-3 pt-2 pb-1 text-[10px] font-medium tracking-[0.08em] text-faint uppercase">
                {GROUP_LABELS[group]}
              </div>
              <ul role="listbox" id={group === "notes" ? "palette-listbox" : undefined} aria-label={GROUP_LABELS[group]}>
                {groupItems.map((item) => {
                  runningIndex++;
                  const index = runningIndex;
                  const active = index === activeIndex;
                  return (
                    <li
                      key={item.id}
                      id={item.id}
                      role="option"
                      aria-selected={active}
                      onMouseMove={() => setActiveIndex(index)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        runItem(item);
                      }}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors duration-150",
                        active ? "bg-accent/14 text-ink" : "text-mute"
                      )}
                    >
                      <span className={cn(active ? "text-accent-ink" : "text-faint")}>
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          <Highlight text={item.label} indices={item.indices} />
                        </span>
                        {item.sub && (
                          <span className="block truncate text-[11.5px] text-faint">
                            {item.sub}
                          </span>
                        )}
                      </span>
                      {active && (
                        <CornerDownLeft className="size-3.5 flex-none text-faint" />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* footer hints */}
        <div className="flex flex-none items-center gap-4 border-t border-line px-4 py-2.5 text-[11px] text-faint">
          <span className="flex items-center gap-1.5">
            <kbd className="kbd">↑↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="kbd">↵</kbd> open
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="kbd">esc</kbd> close
          </span>
          <span className="flex-1" />
          <span className="hidden sm:block">
            {flat.length} result{flat.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>
    </div>
  );
}
