"use client";

import * as React from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Link2, Tag } from "lucide-react";
import { db } from "@/db";
import { noteText } from "@/db/notes";
import { useAutoSave } from "@/hooks/useAutoSave";
import { tagColor } from "@/lib/tree";

/**
 * Phase 1 temporary editor: plain title + textarea with debounced auto-save.
 * Phase 2 replaces the textarea with BlockNote — the auto-save hook,
 * routing and shell stay exactly as they are.
 */
export function NoteEditor({ noteId }: { noteId: string }) {
  const note = useLiveQuery(
    async () => (await db.notes.get(noteId)) ?? null,
    [noteId]
  );

  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");

  // Hydrate local state exactly once per note — NOT on every live-query
  // refresh, or our own autosave would fight the user's cursor.
  const [hydratedId, setHydratedId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (note && hydratedId !== noteId) {
      setTitle(note.title);
      setContent(noteText(note));
      setHydratedId(noteId);
    }
  }, [note, noteId, hydratedId]);

  useAutoSave(noteId, { title, content });

  if (note === undefined) {
    return (
      <div className="grid h-full place-items-center text-sm text-faint">
        Loading note…
      </div>
    );
  }

  if (note === null) {
    return (
      <div className="grid h-full place-items-center px-6">
        <div className="text-center">
          <p className="text-lg font-semibold">Note not found</p>
          <p className="mt-1 text-sm text-faint">
            It may have been deleted.
          </p>
          <Link
            href="/app"
            className="mt-4 inline-flex items-center gap-2 rounded-[10px] border border-line bg-overlay px-4 py-2 text-sm transition-colors duration-150 hover:border-line-strong"
          >
            <ArrowLeft className="size-4" /> Back home
          </Link>
        </div>
      </div>
    );
  }

  const words = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-8 py-8">
      {/* meta row */}
      <div className="flex flex-none items-center gap-3 text-xs text-faint">
        <span className="flex items-center gap-1.5">
          <Tag className="size-3.5" />
          {note.tags.length > 0 ? (
            <span className="flex gap-1.5">
              {note.tags.map((t) => (
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
          ) : (
            "No tags"
          )}
        </span>
        <span className="flex-1" />
        <span>{words} words</span>
        <span>·</span>
        <span>Edited {formatDistanceToNow(note.updatedAt, { addSuffix: true })}</span>
      </div>

      {/* title */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Untitled"
        aria-label="Note title"
        className="mt-4 w-full bg-transparent text-[32px] leading-tight font-bold tracking-[-0.02em] outline-none placeholder:text-faint/60"
      />

      <div className="mt-4 mb-6 flex-none border-b border-line" />

      {/* content (BlockNote lands here in Phase 2) */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Start writing… type [[ to link notes (full support arrives with the block editor)"
        aria-label="Note content"
        className="w-full flex-1 resize-none bg-transparent text-[16.5px] leading-[1.75] outline-none placeholder:text-faint/60"
      />

      {/* backlinks placeholder */}
      <div className="mt-4 flex flex-none items-center gap-2 rounded-lg border border-line bg-overlay px-3 py-2 text-xs text-faint">
        <Link2 className="size-3.5" />
        Backlinks panel arrives in Phase 2, alongside [[wiki-link]] parsing.
      </div>
    </div>
  );
}
