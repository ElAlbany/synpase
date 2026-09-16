"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import { db } from "@/db";
import type { Note } from "@/db/schema";
import { useNotesStore } from "@/stores/useNotesStore";
import { ExportMenu } from "./ExportMenu";

export function Topbar() {
  const pathname = usePathname();
  const saveStatus = useNotesStore((s) => s.saveStatus);

  const noteId = pathname.startsWith("/app/note/")
    ? pathname.split("/")[3]
    : null;

  const note = useLiveQuery<Note | undefined>(
    () => (noteId ? db.notes.get(noteId) : Promise.resolve(undefined)),
    [noteId]
  );

  return (
    <header className="glass flex h-14 flex-none items-center gap-2 border-b border-line px-4">
      <nav className="flex min-w-0 items-center gap-1.5 text-[13px] text-faint">
        <Link
          href="/app"
          className="rounded-md px-1.5 py-0.5 transition-colors duration-150 hover:bg-overlay hover:text-ink"
        >
          Home
        </Link>
        {noteId && (
          <>
            <ChevronRight className="size-3.5 flex-none" />
            <span className="truncate text-ink">
              {note ? note.title || "Untitled" : "…"}
            </span>
          </>
        )}
      </nav>

      <div className="flex-1" />

      <ExportMenu note={note} noteId={noteId} />

      {/* save status chip */}
      <div className="flex h-7 min-w-[88px] items-center justify-end gap-1.5 text-xs text-faint">
        {saveStatus === "saving" && (
          <>
            <Loader2 className="size-3.5 animate-spin text-accent" />
            <span>Saving…</span>
          </>
        )}
        {saveStatus === "saved" && (
          <>
            <Check className="size-3.5 text-teal" />
            <span className="text-teal">Saved</span>
          </>
        )}
      </div>
    </header>
  );
}
