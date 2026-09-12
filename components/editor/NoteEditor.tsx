"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useLiveQuery } from "dexie-react-hooks";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Link2, PanelRightClose, PanelRightOpen, Tag } from "lucide-react";
import { db } from "@/db";
import type { Note } from "@/db/schema";
import { blocksToText, getBacklinks } from "@/lib/wikilinks";
import { useAutoSave } from "@/hooks/useAutoSave";
import { BacklinksPanel } from "@/components/editor/BacklinksPanel";
import { tagColor } from "@/lib/tree";

const BlockEditor = dynamic(
  () =>
    import("@/components/editor/BlockEditor").then((m) => m.BlockEditor),
  {
    ssr: false,
    loading: () => (
      <div className="py-10 text-sm text-faint">Loading editor…</div>
    ),
  }
);

/** Legacy Phase-1 string content becomes a BlockNote document on open. */
function toInitialJson(raw: unknown): string {
  if (typeof raw === "string") {
    if (!raw.trim()) return "[]";
    const paras = raw
      .split(/\n+/)
      .filter(Boolean)
      .map((line) => ({ type: "paragraph", content: line }));
    return JSON.stringify(paras);
  }
  return JSON.stringify(raw ?? []);
}

export function NoteEditor({ noteId }: { noteId: string }) {
  const note = useLiveQuery(
    async () => (await db.notes.get(noteId)) ?? null,
    [noteId]
  );
  const notes = useLiveQuery(() => db.notes.toArray(), []);

  const [draft, setDraft] = React.useState<{ title: string; json: string } | null>(
    null
  );
  const [hydratedId, setHydratedId] = React.useState<string | null>(null);

  // Hydrate exactly once per note (see Phase 1 — our own autosave must never
  // fight the user's cursor).
  React.useEffect(() => {
    if (note && hydratedId !== noteId) {
      setDraft({ title: note.title, json: toInitialJson(note.content) });
      setHydratedId(noteId);
    }
  }, [note, noteId, hydratedId]);

  if (note === undefined || (note !== null && draft === null)) {
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
          <p className="mt-1 text-sm text-faint">It may have been deleted.</p>
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

  return (
    <EditorShell
      key={noteId}
      noteId={noteId}
      note={note}
      initial={draft!}
      allNotes={notes ?? []}
    />
  );
}

function EditorShell({
  noteId,
  note,
  initial,
  allNotes,
}: {
  noteId: string;
  note: Note;
  initial: { title: string; json: string };
  allNotes: Note[];
}) {
  const [title, setTitle] = React.useState(initial.title);
  const [json, setJson] = React.useState(initial.json);
  const [showBacklinks, setShowBacklinks] = React.useState(false);

  useAutoSave(noteId, { title, json });

  const text = React.useMemo(() => {
    try {
      return blocksToText(JSON.parse(json));
    } catch {
      return "";
    }
  }, [json]);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  const backlinkCount = React.useMemo(
    () => (note ? getBacklinks(allNotes, note).length : 0),
    [allNotes, note]
  );

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-8 py-8">
          {/* meta row */}
          <div className="flex flex-none flex-wrap items-center gap-3 text-xs text-faint">
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
            <span>
              Edited {formatDistanceToNow(note.updatedAt, { addSuffix: true })}
            </span>
            <button
              onClick={() => setShowBacklinks((v) => !v)}
              title={showBacklinks ? "Hide backlinks" : "Show backlinks"}
              className="flex items-center gap-1.5 rounded-md border border-line bg-overlay px-2 py-1 transition-colors duration-150 hover:border-line-strong"
            >
              {showBacklinks ? (
                <PanelRightClose className="size-3.5" />
              ) : (
                <PanelRightOpen className="size-3.5" />
              )}
              <Link2 className="size-3.5" />
              {backlinkCount}
            </button>
          </div>

          {/* title */}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled"
            aria-label="Note title"
            className="mt-4 w-full bg-transparent text-[32px] leading-tight font-bold tracking-[-0.02em] outline-none placeholder:text-faint/60"
          />

          <div className="mt-4 mb-2 flex-none border-b border-line" />

          {/* block editor */}
          <BlockEditor
            initialJson={initial.json}
            onChange={(blocks) => setJson(JSON.stringify(blocks))}
          />

          <div className="h-16 flex-none" />
        </div>
      </div>

      {showBacklinks && (
        <BacklinksPanel
          note={note}
          notes={allNotes}
          onClose={() => setShowBacklinks(false)}
        />
      )}
    </div>
  );
}
