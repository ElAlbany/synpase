"use client";

import * as React from "react";
import { CornerDownLeft, FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SuggestRect {
  /** Viewport coordinates of the text caret (fixed positioning). */
  left: number;
  bottom: number;
}

interface Row {
  kind: "note" | "create";
  label: string;
}

const MAX_ROWS = 8;

/**
 * Floating suggestion dropdown for typing `[[` in the editor. Lists note
 * titles matching the query plus a "create" row. Keyboard (↑/↓/Enter/Tab/Esc)
 * is captured at the document level (capture phase) so Enter never reaches
 * the editor while the dropdown is open.
 */
export function WikiLinkSuggest({
  query,
  titles,
  rect,
  onSelect,
  onClose,
}: {
  query: string;
  /** Candidate note titles (already excludes the open note). */
  titles: string[];
  rect: SuggestRect;
  onSelect: (title: string) => void;
  onClose: () => void;
}) {
  const q = query.trim().toLowerCase();

  const rows = React.useMemo<Row[]>(() => {
    const seen = new Set<string>();
    const out: Row[] = [];
    for (const raw of titles) {
      const t = raw.trim();
      const key = t.toLowerCase();
      if (!t || seen.has(key)) continue;
      if (!q || key.includes(q)) {
        seen.add(key);
        out.push({ kind: "note", label: t });
      }
      if (out.length >= MAX_ROWS) break;
    }
    if (query.trim() && !seen.has(query.trim().toLowerCase())) {
      out.push({ kind: "create", label: query.trim() });
    }
    return out;
  }, [titles, q, query]);

  const [active, setActive] = React.useState(0);
  React.useEffect(() => setActive(0), [query]);

  const pick = React.useCallback(
    (index: number) => {
      const row = rows[index];
      if (!row) return;
      onSelect(row.label);
    },
    [rows, onSelect]
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        if (rows.length > 0) setActive((a) => (a + 1) % rows.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        if (rows.length > 0) setActive((a) => (a - 1 + rows.length) % rows.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        pick(active);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [rows, active, pick, onClose]);

  if (rows.length === 0) return null;

  return (
    <div
      role="listbox"
      aria-label="Link suggestions"
      className="fixed z-50 max-h-64 w-64 overflow-y-auto rounded-xl border border-line bg-raised p-1 shadow-[0_12px_40px_rgba(0,0,0,.35)] backdrop-blur-[16px]"
      style={{ left: rect.left, top: rect.bottom + 6 }}
    >
      <div className="px-2.5 pt-1.5 pb-1 font-mono text-[10px] tracking-[0.08em] text-faint uppercase">
        Link to…
      </div>
      {rows.map((row, i) => (
        <button
          key={`${row.kind}:${row.label}`}
          type="button"
          role="option"
          aria-selected={i === active}
          onMouseDown={(e) => {
            e.preventDefault(); // keep editor focus
            pick(i);
          }}
          onMouseEnter={() => setActive(i)}
          className={cn(
            "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px]",
            i === active ? "bg-accent/14 text-ink" : "text-mute"
          )}
        >
          {row.kind === "create" ? (
            <Plus className="size-3.5 flex-none text-accent-ink" />
          ) : (
            <FileText className="size-3.5 flex-none text-faint" />
          )}
          <span className="min-w-0 flex-1 truncate">
            {row.kind === "create" ? (
              <>
                Create <span className="font-medium">{row.label}</span>
              </>
            ) : (
              row.label
            )}
          </span>
          {i === active && <CornerDownLeft className="size-3 flex-none text-faint" />}
        </button>
      ))}
    </div>
  );
}
