"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { format } from "date-fns";
import { History, RotateCcw, X } from "lucide-react";
import { listSnapshots, restoreSnapshot } from "@/db/history";
import { blocksToText } from "@/lib/wikilinks";

function wordCount(content: unknown): number {
  const text = blocksToText(content).trim();
  return text ? text.split(/\s+/).length : 0;
}

/**
 * Slide-over version history: local snapshots of the open note, newest first.
 * Restore uses a two-click inline confirm (same pattern as NoteTree delete) —
 * first click arms for 2.5s, second click executes. Never a modal.
 */
export function HistoryPanel({
  noteId,
  onClose,
  onRestored,
}: {
  noteId: string;
  onClose: () => void;
  onRestored: () => void;
}) {
  const snapshots = useLiveQuery(() => listSnapshots(noteId), [noteId]);
  const [armedId, setArmedId] = React.useState<string | null>(null);
  const [restoring, setRestoring] = React.useState(false);
  const armTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (armTimer.current) clearTimeout(armTimer.current);
    },
    []
  );

  const handleRestore = async (snapshotId: string) => {
    if (restoring) return;
    if (armedId !== snapshotId) {
      setArmedId(snapshotId);
      if (armTimer.current) clearTimeout(armTimer.current);
      armTimer.current = setTimeout(() => setArmedId(null), 2500);
      return;
    }
    if (armTimer.current) clearTimeout(armTimer.current);
    setArmedId(null);
    setRestoring(true);
    try {
      await restoreSnapshot(snapshotId);
      onRestored();
    } finally {
      setRestoring(false);
    }
  };

  return (
    <aside className="backlinks-panel flex w-[300px] flex-none flex-col border-l border-line bg-raised/40">
      <div className="flex h-14 flex-none items-center gap-2 border-b border-line px-4">
        <History className="size-4 text-accent-ink" />
        <span className="text-sm font-semibold">
          History · {snapshots?.length ?? 0}
        </span>
        <span className="flex-1" />
        <button
          onClick={onClose}
          aria-label="Close history"
          className="grid size-7 place-items-center rounded-md text-faint transition-colors duration-150 hover:bg-overlay hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {snapshots && snapshots.length === 0 ? (
          <div className="mt-8 px-2 text-center text-[13px] leading-relaxed text-faint">
            No snapshots yet.
            <br />
            Synapse keeps a local version as you edit — up to 30 per note.
          </div>
        ) : (
          (snapshots ?? []).map((s) => {
            const armed = armedId === s.id;
            return (
              <div
                key={s.id}
                className="mb-2 rounded-lg border border-line bg-raised px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium">
                    {s.title || "Untitled"}
                  </span>
                  <span className="flex-none text-[10.5px] text-faint">
                    {format(s.createdAt, "MMM d, yyyy · HH:mm")}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-[11.5px] text-faint">
                    {wordCount(s.content)} words
                  </span>
                  <button
                    onClick={() => void handleRestore(s.id)}
                    disabled={restoring}
                    title={armed ? "Click again to confirm" : "Restore this version"}
                    className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors duration-150 disabled:opacity-50 ${
                      armed
                        ? "border-accent/60 bg-accent/14 text-accent-ink"
                        : "border-line bg-overlay text-mute hover:border-line-strong hover:text-ink"
                    }`}
                  >
                    <RotateCcw className="size-3" />
                    {armed ? "Confirm?" : "Restore"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
