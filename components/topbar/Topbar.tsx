"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, ChevronRight, House, Loader2 } from "lucide-react";
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
    [noteId],
  );

  return (
    <header className="glass flex h-14 flex-none items-center gap-2 border-b border-line px-4">
      <nav className="flex min-w-0 items-center gap-1.5 text-[13px] text-faint">
        <Link
          href="/app"
          aria-label="Home"
          title="Home"
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 transition-colors duration-150 ${
            pathname === "/app"
              ? "border-line bg-overlay text-ink"
              : "border-transparent text-mute hover:border-line hover:bg-overlay hover:text-ink"
          }`}
        >
          <House className="size-4 flex-none" />
          <span className="hidden sm:inline">Home</span>
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

      {/* save status chip */}
      <div className="flex h-7 min-w-0 items-center justify-end gap-1.5 text-xs text-faint sm:min-w-[88px]">
        {saveStatus === "saving" && (
          <>
            <Loader2 className="size-3.5 animate-spin text-accent" />
            <span className="hidden sm:inline">Saving…</span>
          </>
        )}
        {saveStatus === "saved" && (
          <>
            <Check className="size-3.5 text-teal" />
            <span className="hidden text-teal sm:inline">Saved</span>
          </>
        )}
      </div>

      {/* export — pinned to the far right on every screen size */}
      <ExportMenu note={note} noteId={noteId} />
    </header>
  );
}
