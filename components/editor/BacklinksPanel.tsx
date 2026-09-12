"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Link2, X } from "lucide-react";
import type { Note } from "@/db/schema";
import { getBacklinks } from "@/lib/wikilinks";
import { formatDistanceToNow } from "date-fns";

/**
 * Slide-over backlinks panel: every note referencing the open one,
 * with a context snippet. Design spec §3.4 — 320px right panel.
 */
export function BacklinksPanel({
  note,
  notes,
  onClose,
}: {
  note: Note;
  notes: Note[];
  onClose: () => void;
}) {
  const router = useRouter();
  const backlinks = React.useMemo(
    () => getBacklinks(notes, note),
    [notes, note]
  );

  return (
    <aside className="backlinks-panel flex w-[300px] flex-none flex-col border-l border-line bg-raised/40">
      <div className="flex h-14 flex-none items-center gap-2 border-b border-line px-4">
        <Link2 className="size-4 text-accent-ink" />
        <span className="text-sm font-semibold">
          Backlinks · {backlinks.length}
        </span>
        <span className="flex-1" />
        <button
          onClick={onClose}
          aria-label="Close backlinks"
          className="grid size-7 place-items-center rounded-md text-faint transition-colors duration-150 hover:bg-overlay hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {backlinks.length === 0 ? (
          <div className="mt-8 px-2 text-center text-[13px] leading-relaxed text-faint">
            Nothing links here yet.
            <br />
            Mention{" "}
            <span className="font-mono text-accent-ink">
              [[{note.title || "this note"}]]
            </span>{" "}
            from another note to build the connection.
          </div>
        ) : (
          backlinks.map((b) => (
            <button
              key={b.note.id}
              onClick={() => router.push(`/app/note/${b.note.id}`)}
              className="mb-2 block w-full rounded-lg border border-line bg-raised px-3 py-2.5 text-left transition-colors duration-150 hover:border-accent/40"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-medium">
                  {b.note.title || "Untitled"}
                </span>
                <span className="flex-none text-[10.5px] text-faint">
                  {formatDistanceToNow(b.note.updatedAt, { addSuffix: true })}
                </span>
              </div>
              {b.context && (
                <div className="mt-1 text-[11.5px] leading-snug text-faint">
                  {b.context}
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
